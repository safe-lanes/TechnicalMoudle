# Crewing chatbot — Part B on the isolated pilot (30-Oct-2026)

Scope: availability, relief due, rest hours, rotation approvals, manning/vacancies, appraisals — built on the existing
reusable read-only tool architecture, per Sahil's accepted decisions (B1–B6) and Ghazi's appraisal-score decision.
Isolated pilot only: local Crewing trial servers and trial databases on this laptop, pilot assistant container on the AI
server. No merge, deployment, live registration change or production access. Part B is committed locally and NOT pushed.
Evidence labels: PROVEN = run on the pilot with the output recorded in `scripts/assistant-trial/results/`; READ = code.

## 1. Short version

1. **Six new tools work on the pilot**, one per area, each with a strict argument schema and the same envelope, paging,
   `excluded` counts and rank-configuration report as the two-area tools.
2. **Verified three ways:** independent plain SQL vs the tools agree on all three trial databases (**81/81**, Part A + B);
   hand-derived direct checks **126/126**, plus **14/14** permission checks on a chatbot-allowed role without the Part B
   menus; model runs on the final build: Part B **22/23** (held-out 6/6), two-area regression **47/47** (held-out 11/11).
3. **Appraisal scores follow your decision, with one gap.** Scores are the overall rating of completed appraisals only,
   shown only on explicit request and only to a role holding the Crewing "Appraisals All" view right. Draft scores,
   assessment scores and remarks are never returned (a planted confidential remark never appears). **Gap:** Crewing has no
   trusted link from a login to a crew record (`crew_members_v2` carries no user id or e-mail; `master_users` has no crew
   id), so **"my own appraisal" is refused** with that reason instead of being guessed. Nothing was widened for Sail Admin.
4. **Masking and isolation hold:** 323 outbound model requests carrying Part B tool results contain no real fixture name;
   history separation T1–T8 unchanged; company B never sees company A's availability, relief, rest hours, plans, positions
   or scores (I7–I13).
5. **Technical, documentation answers, the widget and knowledge training are unchanged:** same gate and cited sources as
   the released code for Technical and Crewing how-to questions, identical suggestions, no widget or knowledge code touched.
6. **Volume:** 17 tool calls on 4,000 crew / 16,000 documents / 1,200 rest-hour months / 2,000 appraisals: all succeed;
   16 under 1 s median; the Part A "documents expiring in 60 days" count is 1.1–1.5 s steady (one 5.3 s outlier under
   concurrent model load). Every statement stays inside the 5 s statement timeout.

## 2. Rules implemented (from the decisions; nothing reopened)

| Area | Rule (Sahil / Ghazi) | Implementation detail resolved from the code |
|---|---|---|
| B1 availability | on leave with a date ≤ the asked date (already available included) **or on board with a Next Availability date**; terminated never; NFR only on request | dates from `crew_members_v2` first, `crew_personal_details` second (the crew dashboard's own fallback); inactive crew not available (status precedence Terminated → Inactive → On Board → On Leave, `calculateCrewStatus`); crew without a date counted in `excluded.noAvailabilityDate`; "in December" = by 31 Dec; named person via `find_crew` + `crewIds` |
| B2 relief due | Due Crew screen rule; show the recorded relief-due when it differs | `dueCrewService`: contract end = sign-on + range-start or contract months, else recorded relief-due; range end; overdue = past range end; due-in-window = recorded relief-due in window or overdue; `reliefDueDiffers` per row + note |
| B3 rest hours | live recalculation, rest mode, OPA off unless asked; month and last-updated always stated | the RH module's own `getViolationDates` / `calculateNCs` (same calls as the date-accurate report), record's applicable days honoured, stored monthly totals never read; default month = as-of month; `lastUpdated` returned |
| B4 rotation approvals | waiting = Proposed / Partially Approved, company-wide; "for me" on request | `getProposals` status set; per-entry Pending / Deployed / Rejected counts; drafts separate. **Crewing assigns no approver per plan** (any user with the Rotation permission approves) → "for me" = the waiting plans if the VERIFIED login holds the Rotation right, else none — stated in `notes` |
| B5 manning | a signed-on person fills a position, else vacant | positions = primary rows on ACTIVE vessels (empty slots included); filled = signed on, or signed-on reliever in handover; `vacant` vs `vacant_not_signed_on`; ranks per Rank Administration |
| B6 appraisals | pending = submitted not completed; drafts separate; archived/terminated excluded; vessel by record | status classes from `appraisalResultsService.STATUS_ORDER` (draft / preliminary·submitted·pending_review / reviewed) plus the report's synonyms; crew join excludes archived, deleted, terminated; vessel = current on-board vessel; the appraisal's own vessel text shown as recorded |
| Scores (Ghazi) | overall score of completed appraisals on explicit request; own score without extra role; others need the Crewing permission; refuse when identity/permission can't be established | **permission traced:** Crewing's appraisal API has no per-record check; the only mechanism is the Access Control menu **"Appraisals All"** (view) → required for any appraisal data. **Own score: refused** (no trusted login → crew mapping exists). Draft / assessment scores / remarks: never selected |

Permissions (all areas, every call, direct API included): Office-only and the chatbot role allow-list unchanged, role
re-resolved on the server, then the VIEW right of the menu each area reads — Crew Pool (availability), Vessel + Due (relief),
Rest Hours + Vessel, Rotation, Vessel (manning), Appraisals All (appraisals). Company isolation by the tenant database.

## 3. Verification (final build)

| Check | Result |
|---|---|
| Independent SQL vs tools, A / B / C (Part A Q01–Q16 + Part B P01–P15) | **81/81** (`expected-compare-partb2.json`) |
| Direct checks, main phase (counts, lists, filters, dates, paging, missing data, auth, isolation) | **126/126** |
| Direct checks, permission phase (External 1, chatbot-allowed, no Part B menus) | **14/14** (scores and "for me" refused; no score field leaks) |
| Chat Part B set v3 on crewtrial-cd586d70b | **22/23**, held-out **6/6** (`v3-final.json`) |
| Chat two-area regression v2 on the same build | **47/47**, held-out **11/11** (`v2-final-partb.json`) |
| Masking T1–T8 + names on the wire | history only on legitimate follow-ups; discarded on restart / other user / company / issuer / new conversation; 0 real names in 323 requests carrying Part B results |
| Shared behaviour vs released v10 code | same gate + cited sources on 4 Technical / Crewing how-to questions; suggestions identical |
| Volume (crew_trial_v) | 17/17 ok; see §1.6 (`volume-check.json`) |
| Crewing tsc / assistant pytest | 229 = baseline / 130 passed |

Run history kept as evidence: v3-run1 18/23 and v2-regr-partb 45/47 before the fixes (harness gaps P13/P14/P18, a test
design flaw P17 — a "User" login is stopped by the chatbot role gate before any area, so the permission checks moved to
External 1 — a genuine miss P04 fixed with `crewIds` and the "in <month>" rule, and v2 C28 versioned for Sahil's B2).

Remaining miss in the final run: **P12** — "plans waiting for my approval" returned the right plans but the model did not
relay the note that Crewing has no per-plan approver. Data correct; wording only.

## 4. Limitations

- **Own appraisal score unavailable** until Crewing records a trusted login → crew link (e.g. a crew id on the user, or a
  user id on the crew record maintained by Crewing). That is a Crewing data-model change, not a chatbot setting.
- **"For me" rotation approvals** can only mean "you hold the Rotation right": Crewing does not assign approvers per plan.
- **Rotation right granularity:** "for me" uses the Rotation **edit** right as "can approve"; whether Crewing distinguishes
  approve from edit was not found in the code (no separate approval permission exists).
- Local data has no availability dates, no pending appraisals and no current-month rest-hour records — those scenarios rest
  on labelled synthetic cases (fixture v3, SYN C6–C13), as instructed. Fixtures prove the rules, not occurrence on dev.
- Part A documents count at volume: 1.1–1.5 s steady; acceptable, but the first candidate if dev data is larger.
- P12 wording (above); model variance seen in earlier runs (C20.2) did not recur in the final run.
- Genuine SAILERP login and dev acceptance remain release requirements; the pilot's mock identity is not production auth.

## 5. Versions (local, NOT pushed)

| Item | Value |
|---|---|
| Crewing | `feature/assistant-livedata-trial` @ **`faca37ef`** (on pushed `3457b6718`) — 32e24d84 tools, f6e14951 fixes + volume, faca37ef final results |
| Assistant | `feature/crewing-livedata-trial` @ this report's commit (code **`cd586d70b`**, on pushed `77a0c95c5`) |
| Pilot image | `sail-assistant-py:crewtrial-cd586d70b` (container `sail-assistant-py-crewtrial` :8062); kept stopped: -pb1 (56d5fbe0c), -v2final (54b0e1beb) and earlier |
| Trial DBs | crew_trial_a / _b (fixture v3), crew_trial_c (local copy + SYN C1–C13), crew_trial_v (volume), crew_trial_master (tenants a, b, c, v, x) |
| Trial servers | :6100 / :6101 with `ASSISTANT_ALLOWED_ROLES=Sail Admin,External 1` for the permission phase (pilot only) |

## 6. Proposed next step

1. Your review of this report and the appraisal-identity gap; your approval to push the Part B commits to the two trial
   branches.
2. Crewing team (Datta): decide whether a trusted login → crew mapping will exist; until then "my appraisal" stays refused.
3. Then the release path already agreed: harden for merge (trial report §10), genuine-login test, dev acceptance with
   Sahil/Sagar's examples on the acceptance day.
