# Crewing chatbot — Sahil's business-rule decisions applied to the two pilot areas (29-Oct-2026)

Source: `Crewing-Chatbot-Business-Rules-Questionnaire_responses.docx` (Sahil, received 29-Oct-2026): green-highlighted ticks,
written comments, two screenshots (Rank Administration → Company tab; a crew Status card with "Next Availability"), one Word
comment (B3). Unticked boxes were NOT treated as approval. Isolated pilot only: local Crewing worktree + trial databases on
this laptop, pilot assistant container on the AI server. Nothing pushed, merged or changed on dev/prod; dev/prod were not read.

Evidence labels: **PROVEN** = run on the isolated pilot with output recorded here or in `scripts/assistant-trial/results/`;
**READ** = concluded from reading the Crewing code; **INFERRED** = deduction, stated as such.

---

## 1. Short version

1. Sahil answered Part A: certificates = both kinds (A2), ask for a period (A3), **list expired together with expiring (A4)**,
   **rank groups must come from Rank Administration, not a fixed table (A5)**, exclude terminated / include inactive (A6),
   output fields OK (A7). A1 was not ticked; his comment corrects our understanding of "secondary" (handover state, not a
   second ship). He gave no expected-result examples (the yellow boxes are empty).
2. All six are now applied on the pilot and verified three ways: hand-derived expectations, an independent plain-SQL script,
   and the live-data tool — they agree on all three trial databases (42/42), the direct endpoint checks pass 84/84, tsc is at
   the baseline (229) and the assistant's unit tests pass (128).
3. The on-board SQL did not need to change: the Vessel-screen rule it already used (primary or secondary, signed on, not
   archived) is exactly Sahil's handover definition. The wrong part was our *explanation* and a fixture that put one person on
   two ships; that fixture is corrected (kept only as a labelled invalid-data case).
4. Part B is recorded for later (section 5): the "Next Availability while on board" case, company-wide approvals with "for
   me" on request, manning following the signed-on rule, relief = Due Crew rule, rest hours = live, OPA off unless asked.
   B2/B3 discrepancies were investigated read-only (section 6). Appraisal scores stay excluded; one clarification is drafted
   for you to send (section 7).
5. Genuine open points for Sahil: whether very old expired documents should be listed (no lower bound today), the
   "Terminated" definition tick, Electrical Officer / cadets (both now follow the Company tab), and the appraisal-score line.

---

## 2. Decision mapping (question → Sahil's answer → what changed → open point)

| Q | Sahil's answer | Applied where | Tests | Unresolved |
|---|---|---|---|---|
| **A1** secondary = on board? | **No tick.** Comment: a seafarer is on ONE vessel at a time; a planned reliever appears in the reliever status but does not add to the count. "Primary/secondary" is the **handover** state: the reliever who signs on becomes *secondary*, the person already on board is *primary*; after "Takes over" they swap; **both count while both are on board.** | On-board SQL unchanged (`ON_BOARD_VP`: crew_status primary/secondary, not archived/deleted, crew + vessel + sign-on date set — the Vessel-screen rule). Wording of `DEFINITIONS.onBoard`, the tool manifest and the assistant rules rewritten to the handover meaning; `crewStatus` filter described as "only when the user says so". Fixture v2: handover case (Nadira primary + Oswin secondary, Beta Ocean Chief Officer), planned reliever stored on the primary's row (Kestrel on Corvina's row; not on board). | A2, A14, A14b, A17, A17b, N01, N02, N08; Q01–Q03 on all three DBs | Whether the "Crew on board" **report** (which lists people not yet signed on) should be aligned — not our scope; mention to Sahil. |
| **A2** "certificates" | **A** — both kinds (ticked). | Already the trial rule; definition now CONFIRMED; manifest + assistant text say "both unless the user names one kind". | D1, Q07 | — |
| **A3** no period given | **A** — ask (ticked). | Already the trial rule (assistant rule unchanged, re-worded). | C11 (chat) | — |
| **A4** expired documents | **B** — list expired together with expiring (ticked). | New expiry state `expired_or_expiring` = **default** when a window is given and no state: documents already expired (any age) + those expiring by the window end. Every row carries `expiryState` expired/upcoming; results carry `breakdown` (expired / upcoming counts, documents and people) and `expiryWindow`; the assistant appends a deterministic line "Of these, N … already expired …; M … expire by <date>." from the server's counts. `not_expired` = "only upcoming" on request. A future window never narrows "expired" (bug found by direct check A9 and fixed). | D3, D3b, D4, D4b, D5, D6, D6b, D12, D13b, D16, A9, A9b; Q10–Q15; C05, C06, C19, C21, N04 (chat) | **No lower bound**: a document that expired years ago is listed as expired (Ulric's 2024 training in the fixture). Ask Sahil whether to cap (e.g. ignore documents expired more than 12 months). |
| **A5** rank groups | Green note: **"Always use reference from this Admin section for rank categories, rather than relying on a hard coded table."** + screenshot of Rank Administration → Company tab. Table not confirmed; Electrical-Officer question not ticked. | Hard-coded `RANK_GROUPS` **removed**. New `rankConfig.ts` loads `adm_company_ranks_v2` (Company tab) flags: officer, rating, senior_officer, deck_officer, eng_officer, petty_officer, deck_rating, engine_rating, general_rating, catering_rating → groups `officers, ratings, senior_officers, deck_officers, engine_officers, petty_officers, deck_ratings, engine_ratings, general_ratings, catering_ratings`; word unions `engineers` = engine_officers, `deck`, `engine`. **`cadets` removed** (no flag exists). Rank → config row by `rank_id` (R001…), else by normalised name (company rank, role variant AB_1, Rank Master name of the same rank_id). Ranks with no category or not configured = **unclassified**: reported in `rankConfig.unclassifiedOnBoard / unclassifiedInResult` and `unclassifiedConfiguredRanks`; configuration contradictions in `rankConfig.issues`. Never substituted. | A5, A5b, A12, A13, A13b, A15, A16–A16c, A18, A19, U7, D7; Q04, Q05, Q15; N03, N05 (chat) | Electrical Officer counts as an engineer **because the Company tab flags it Eng Officer** (local and in Sahil's screenshot) — confirm that is intended. Cadets: no category → not in any group (local tab and screenshot differ: screenshot ticks Deck Officer for Deck Cadet). See 4.2 for the inheritance trace and the local configuration gaps. |
| **A6** inactive / terminated | **A** — exclude terminated, include inactive (ticked). "Terminated definition OK?" **not ticked**. | Documents area: crew with status starting with `Terminated` excluded (`NOT ILIKE 'Terminated%'`), inactive (`is_active=false`) included; archived/deleted exclusions kept. Lookups (`find_crew`) unchanged. | D1, D15, D15b, Q07, Q08; N06, N07 (chat) | Definition "status starting with Terminated" assumed (covers the UT/BT/General/NFR spellings the reports use three ways). Local data uses lower-case `active / inactive / on_leave`, code writes `Terminated` — both handled. Ask Sahil to tick. |
| **A7** output fields | **OK as is** (ticked). | Unchanged: name, rank, vessel, document name/expiry, sign-on / relief-due dates, counts. The only additions are counts and flags (`expiredDocuments`, "(expired)" marker in the document list, `rankConfig`, `breakdown`) — no new personal field. | masking T-checks (section 3.4) | — |
| **Examples** | Empty (yellow boxes blank). | Generated locally instead: fixture v2 (hand-derived), independent SQL, isolated copy of the local database (section 3). | — | Sahil's own two cases per area would still be the acceptance evidence on dev data. |

---

## 3. Verification

### 3.1 Data snapshots (fixed, fingerprinted)

| DB | What | Rows (crew / plans / licences / trainings / company ranks) | data_md5 |
|---|---|---|---|
| `crew_trial_a` | synthetic fixture v2 (4 vessels) | 29 / 24 / 15 / 13 / 40 | `2b9de972f32d70cbca8f3525bbc3c900` |
| `crew_trial_b` | second company (isolation) + labelled INVALID-DATA case | 8 / 9 / 1 / 1 / 40 | `2f8c4ec2b6d79a39354d511d9b460998` |
| `crew_trial_c` | **isolated copy of the local Crewing DB** (`CREATE DATABASE … TEMPLATE crew_management_local`, original untouched) + 5 labelled `SYN-` cases | 128 (5 SYN) / 22 / 125 / 185 / 40 | `3a62cdc7ff0e7a32acfec3838eb20a01` |

As-of date pinned to **2026-11-01** on both trial servers (`ASSISTANT_DATA_AS_OF`). Fingerprints and expected values:
`scripts/assistant-trial/results/expected-crew_trial_{a,b,c}.json`. Rebuild: `setup-trial-dbs.ts` (A/B) then
`setup-trial-local-copy.ts` (C; registers `trial-c.local` in `crew_trial_master`).

Synthetic cases in the local copy (all on the real vessel "Prime Fortune", emp_no `SYN-00n`, names starting "SYN"):
C1 signed-on reliever (secondary) next to the real Chief Officer; C2 planned reliever on the real Master's row (not signed
on); C3 terminated 3rd Officer with a licence expiring 15-Nov; C4 inactive Chief Cook with a training certificate expiring
18-Nov and a licence expired 2019; C5 Gas Engineer on board (no category on the Company tab). Boundary documents on C1:
expires on the as-of day, on the 60-day end (31-Dec), on the 2-month end (1-Jan-2027), expired the day before as-of.

### 3.2 Independent expected results vs the tool — PROVEN

`expected-results.ts derive` runs plain SQL written from Sahil's rules (its own CTEs for on-board, Company-tab flags,
documents, expiry — not the tool's query builders) for 16 questions per database; `compare` calls the endpoint for the 14 of
them that map to a tool call. **42/42 agree** (`results/expected-compare-fix2.json`). Instrument check: with one expected value
deliberately set to the old double-counted number (B fleet 7 instead of 8) the comparison reports **41/42 with that FAIL** —
the comparison can fail. For tenant A the SQL values also equal the hand-derived expectations below (three-way agreement).

Hand-derived (tenant A, as-of 2026-11-01): fleet 20 people / 20 assignments (Alpha Star 8, Beta Ocean 7 = 6 primary + 1
secondary, Alpha Trader 5, Gamma Bay 0); engineers (Eng Officer flag) 7, unclassified on board 2 (Gas Engineer, Deck Cadet);
officers 14, ratings 4, deck ratings 2 (incl. AB_1 matched by name after the mistyped rank_id `RO15`), catering 1; signed on
in the last 30 days 4 (+1 unreadable date); documents 24 / 18 people (2 terminated crew's documents and the archived licence
and archived crew excluded, the inactive crew's included); expired 3 (incl. one from 2024); expiring 30 days = 13 documents /
12 people (3 expired + 10 upcoming); 60 days = 18 / 14 (15 upcoming); 2 months = 19; on board 60 days = 14 / 11 (Alpha Star
4, Beta Ocean 7, Alpha Trader 3); Beta Ocean engineers 60 days = 5 documents / 2 people.

Local copy (tenant C) results worth reading: fleet 22 on board (21 real + the SYN Gas Engineer; the SYN secondary makes 22
assignments = 22 people because the real Chief Officer is also there), 1 secondary; engineers 5 with **2 unclassified on
board** (real Deck Cadet + SYN Gas Engineer); documents 271 / 120 people, 51 without an expiry date, the terminated SYN
crew's licence absent (Q08 confirms it exists in the raw table); expired 18 (16 real licences May–Oct 2026 + 2 SYN); expiring
30 days = 25 (18 expired + 7 upcoming); 60 days = 29; 2 months = 30; on board 60 days = 9 documents / 5 people.

### 3.3 Direct endpoint checks — PROVEN 84/84

`direct-checks.ts` v2 (hand expectations): counts, groups, paging (5 pages of 4 → 18 distinct rows), unknown/ambiguous never
zero, injection/schema, 11 authentication cases (401s), role re-check, company isolation (A sees 8 on "MV Alpha Star", B
sees 5; B's invalid-data person listed once with 2 assignments), single-tenant instance 20. The first run failed **A9**
(breakdown of people with expired documents was 0): a future window was being applied to "expired" — fixed in
`expiryConditions`, re-run 84/84 and compare 42/42 (so the harness does detect a wrong number).

### 3.4 Chat (model) runs and regressions

See section 8 (filled from `results/v2-run1.json` and the masking checks) — kept separate because the model path is
non-deterministic and scored per turn.

### 3.5 Baselines

Crewing `tsc --noEmit`: 229 before = 229 after. Assistant pytest: 127 before → 128 after (one new unit test for the
breakdown line). Technical module instructions byte-identical (existing test).

---

## 4. Corrections to our earlier understanding

### 4.1 "Secondary" (A1) — our explanation was wrong, the SQL was right

- READ (`vesselPlanningService.signOnReliever`): a planned reliever is stored **on the primary's row** (`reliever_crew_uuid`,
  `reliever_sign_on_date`, `joining_status`), never as an on-board row. "Sign on reliever" creates a **new row with
  `crew_status = 'secondary'` and a sign-on date** on the same vessel and rank (CASE A) or promotes the reliever to primary
  when the position is vacant (CASE B). On sign-off the primary row is archived and the secondary becomes primary.
- READ (`checkSignOnConflict`): a crew member with an active on-board assignment cannot be signed on anywhere else — the v1
  fixture's "primary on Alpha Star and secondary on Beta Ocean" cannot arise through the UI. It is kept only in tenant B,
  labelled INVALID DATA, to show the tool's behaviour on such rows (1 person, 2 assignments).
- READ: no code writes `crew_status = 'relief'`; the v1 "relief-only row" was not a real state and is replaced by the
  reliever fields on the primary's row.
- Consequence: the Vessel-screen count rule (and our on-board SQL) already implements Sahil's rule; v1 totals changed only
  because the fixture changed (e.g. fleet 16 people / 17 assignments → 20 / 20).

### 4.2 Rank Administration — configuration and inheritance trace (A5)

READ (`AdminModule.tsx`, `companyRanksRepository.ts`, `vesselRevisionsService.getRanksByVesselId`):

1. **Rank Master** (`adm_available_ranks_v2`): the catalogue; `applicable_to_company` decides which ranks the Company tab
   offers; `rank_id` (R001…) is the stable key (`vessel_planning_v2.rank_id` stores it).
2. **Company tab** (`adm_company_ranks_v2`): one row per rank plus one per role variant (AB_1 …) with the category flags
   (Officer, Rating, Senior Officer, Deck Officer, Eng Officer, Petty Officer, Deck Rating, Engine Rating, General Rating,
   Catering Rating) and duty flags (Safety Officer, SSO, Medical, Navigating, Envt. Officer).
3. **Vessel tab**: a per-vessel revision (JSON). When the vessel's ranks are read, the **category flags are taken from the
   company row first** (`companyRank?.officer ?? vesselRank.officer`); only the **duty flags are vessel-first**. So for
   "officers / engineers / ratings" the Company tab is the authority and no vessel override exists; duty roles (SSO etc.)
   are per vessel and are not offered as groups by the chatbot (they would need the vessel revision data).

Local configuration (the template of all three trial DBs) — PROVEN by query, data points not a pattern:

- Ranks with **no category flag**: Gas Engineer, Fifth Engineer, Motorman, Wiper, Deck Cadet, Engine Cadet → unclassified.
  Sahil's screenshot (dev) differs: Gas Engineer has Eng Officer ticked and Deck Cadet has Deck Officer ticked there.
  The chatbot follows whichever configuration the company has; it reports the unclassified ranks instead of guessing.
- Company rank names differ from Rank Master names ("2nd Officer" vs "Second Officer", "AB" vs "Able Bodied Seaman");
  matching by `rank_id` and by the Rank Master name of the same id covers both spellings.
- One assignment row carries the rank_id `RO16` (letter O) — the by-name fallback catches it; the fixture reproduces it
  (`RO15`).
- No contradiction found (no rank flagged both Officer and Rating; role variants carry their parent's flags). The tool
  reports contradictions in `rankConfig.issues` when they exist.

### 4.3 Expiry (A4)

Each list/count with an expiry condition now reports `breakdown.expired` and `breakdown.upcoming` (documents and people)
and `expiryWindow {from, to, state}`; rows carry `expiryState`; the person-level list adds `expiredDocuments` and marks
expired names "(expired)". The assistant appends the deterministic sentence from these counts (never from the model).

---

## 5. Part B — recorded, NOT built

| Q | Sahil's answer | Recorded rule for the later build |
|---|---|---|
| **B1** availability | **A** (ticked) + comment: a Chief Officer currently **on board**, signing off 20-Nov with **Next Availability** set (e.g. 5-Dec) must also appear in "available to join". Screenshot: the crew Status card's "Next Availability" field. | "Available to join as <rank> by <date>" = crew NOT terminated, rank matches, and (on leave with availability ≤ period end) **OR (on board with `next_availability` ≤ period end)**; people available today included; "not for rehire" only when asked. Data: `crew_members_v2.availability`, `next_availability` (text dates). Local copy has no `next_availability` values — synthetic cases needed when built. |
| **B2** relief due | **A** — Due Crew screen rule (ticked) + "There should not be different values for these dates… Better to check this". | Due = Due Crew rule (section 6.1). Mention the recorded relief-due date only when it differs. |
| **B3** rest hours | **A** live, rest mode (ticked); OPA **off unless asked** (ticked). Word comment on "stored monthly totals": "We need to check this discrepancy later, why these values can be different." | Live recalculation from daily records (the overview's engine), rest mode, OPA off unless the user says "with OPA"; always state month and last-updated date. Discrepancy explained read-only in 6.2. |
| **B4** rotation approvals | **confirmed** (ticked) + "Unless the person asks specifically which plans are waiting for approval for me". | Default: all Proposed / Partially Approved plans in the company (within the user's permissions); "for me" = only entries awaiting the **verified** user (server identity, never the model's guess); drafts listed separately. |
| **B5** manning | not ticked; comment: "If a seafarer has Signed on then he fills a position, else not." | Vacancy = required position on the manning scale without a **signed-on** person (primary or signed-on secondary both fill); active vessels only; ranks matched via Rank Administration (A5); planned relievers do not fill. Consistent with A1. |
| **B6** appraisals | **A** drafts separate (ticked); "scores never shown: ☐ agreed / ☑ needed for: ____" — **ticked "needed for" with nothing written**. | Pending = submitted-not-completed, drafts separate, vessel matched by record, archived/terminated excluded. **Scores remain excluded** (A7 OK as is) until the clarification in section 7 is answered. |

---

## 6. Read-only findings on Sahil's reported discrepancies (no code or screen changed)

### 6.1 B2 — recorded relief-due date vs the Due Crew rule

- READ (`vesselPlanningService.signOnReliever`, lines ~1305–1311): at sign-on the recorded `relief_due` is **auto-calculated
  = sign-on date + contract months** (JavaScript `setMonth`). So at sign-on the two agree.
- READ (`dueCrewService.ts`): the Due Crew screen computes **contract end = sign-on + `contract_end_range_start_months`**, else
  + `contract_period_months`, else the recorded relief-due; **range end = sign-on + `contract_end_range_end_months`**;
  "overdue" = range end before today; "due in N months" = recorded relief-due inside the window **or** overdue by range end.
- READ (`vesselPlanningService.updateVesselPlanning`, lines ~940–965): `relief_due` and `contract_period_months` can be edited
  independently afterwards (the update mirrors them to `crew_assignments`); nothing recomputes one from the other.
- Where the two values can differ (READ, mechanisms): (a) relief-due edited by hand after sign-on; (b) contract months or the
  tolerance range changed after sign-on; (c) a tolerance range set (`contract_end_range_*`) — the screen then uses the range
  start, not relief-due; (d) a sign-on date that does not parse — the screen falls back to the recorded relief-due.
- PROVEN data point (local copy, 20 real on-board rows): recorded relief-due equals sign-on + contract months on **every row**;
  no tolerance ranges set. No divergence in local data — the mechanism exists, occurrence on dev/prod is unknown (not read).

### 6.2 B3 — Rest Hours overview vs the monthly violation report

- READ (`reports/handlers/restHours.ts`): the monthly report (`rh-violations`) reads **stored** `rh_crew_records_v2.total_violations`
  / `total_nCs` (rows with `total_violations > 0`); its opt-in "date" branch recalculates from `daily_records` with the RH
  engine (`getViolationDates(…, "Rest", false, …)` — OPA off, as recorded in the questionnaire).
- The overview recalculates live from the daily records with the per-record OPA checkbox. So after a daily record is edited,
  the stored monthly total stays until whatever writes `total_violations` runs again; the overview changes immediately. That
  is the mechanism of the discrepancy. Which process refreshes the stored totals, and when, was not traced (out of scope for
  the read-only check); the chatbot rule "live recalculation" avoids the stored figure altogether.

---

## 7. Clarification to send on appraisal scores (one question)

> Sahil — in the questionnaire, A7 keeps appraisal scores out of the chatbot ("OK as is"), but under B6 you ticked "scores:
> needed for" without saying for what. Appraisals are a later area, so this does not hold up the current work. When we get to
> it: which appraisal information should the chatbot be allowed to show, to whom (which roles), and in which form — the
> overall score only, a rating band (e.g. "satisfactory"), or no numbers at all with just the status (pending / completed)?
> Until then scores stay excluded.

---

## 8. Chat runs on the pilot (model path) and regressions — PROVEN

Test set v2 (`scripts/assistant-trial/test-set-v2.json`): the 34 v1 cases with expectations rewritten for fixture v2 and the
A4 default, plus 8 new cases (N01–N08: handover, planned reliever, unclassified ranks, upcoming-only, deck ratings,
terminated, inactive, primary-only on request). 47 turns, 11 held-out turns never used for tuning. Each turn scored on the
logged tool call (q), its result (d) and the answer text (a). Results in `results/v2-run{1,2,3}.json`.

| Run | Image | Turns | Held-out | Failures and what they were |
|---|---|---|---|---|
| run 1 | 0e023ea84 | 42/47 | 11/11 | C05, N03 data score = **harness gap** (the trial log did not record `breakdown` / `rankConfig`; answers were right); C08 = **valid alternative route** (assignments tool: 11 people by vessel instead of 14 documents); C16 = **narrow regex** ("isn't a recognised rank" is correct); **C06 and N03 answers = genuine model misses** ("licence or certificate" sent as licences only; unclassified ranks not mentioned). |
| run 2 | 598ee24ad (both-kinds wording; deterministic unclassified-rank line) | 44/47 | 11/11 | C06 again (model still chose licences only → moved into the query guard); C25 = **transient** ("I'm having trouble answering" after a network drop; passes on retry, `results/v2-c25-retry.json`); N02 = **narrow regex** ("not shown as on board … no current vessel" is correct). |
| run 3 | **54b0e1beb** (guard: licence-only needs the user's words) | **46/47** | **11/11** | N02 only — regex again ("not currently shown as on board … vessel is recorded as blank" is a correct answer; regex widened afterwards, recorded here rather than re-run). |

Every rule-bearing case passed in run 3: expired listed with expiring and both counts stated (C05 "18 … 3 already expired …
15 expiring by 2026-12-31", C06 12 people, C19, C21 9 people incl. Dagny and Marek, N04 upcoming-only 12), handover (N01
Nadira + Oswin, C02 7, N08 primary-only 19), planned reliever not on board (N02 answer text), unclassified ranks reported
(N03 "1 engineer" + the server line naming Gas Engineer and Deck Cadet), deck ratings via the Company tab (N05 Gisla, Una),
terminated excluded (N06 no licence shown for Pelham), inactive included (N07 Rowena), isolation (C32–C34), denials
(C30–C31). Model variance seen but not failing: C08 chooses the assignments route; the model sometimes writes its own
expired/upcoming sentence in addition to the deterministic one (duplicate wording, same numbers).

Harness corrections made during the runs (all recorded in the test-set `_note`s and commits): arg log now records
`breakdown` and `rankConfig`; C08 accepts the assignments route; C16 and N02 regexes widened to correct wordings. No expected
number was changed to make a run pass.

### Regressions kept green

- Masking / conversation separation T1–T8 (`masking-checks-r3.ts` + `inspect_roles.py` on capture lines 1336–1370): history
  sent only on a legitimate follow-up by the same user, with the synthetic names masked (names on the wire = the user's own
  typed words in the current message, the known remaining disclosure); restart (T2), another user (T3), another company (T5),
  another issuer (T6) and a new conversation carrying old history (T7) all discard both roles with the notice; the owner keeps
  their state afterwards (T4, T8). Observation: in T1 the model answered the follow-up by asking for the name again instead of
  re-running `find_crew` (T4 and T8 answered the same follow-up correctly) — model variance, same mechanism as round 3.
- Technical module instructions byte-identical (`test_technical_instructions_unchanged`); pytest 130 = 127 + 3 new.
- Crewing tsc 229 = baseline; direct checks 84/84 after every server restart; independent SQL comparison 42/42.
- Permissions and tenant isolation: X1–X11, R1–R6, I1–I6, E1–E5 in the direct checks (per-area menu permission, Ship users
  refused, role re-resolved on the server, company X inactive, tuid/domain mismatch 401).

---

## 9. Genuine remaining ambiguities (for Sahil / Sagar)

1. **Expired without limit** (A4): list documents expired years ago as "expired"? If not, what cut-off?
2. **Terminated definition** (A6): "status starting with Terminated" — please tick.
3. **Electrical Officer / cadets / Gas Engineer** (A5): the chatbot follows the Company tab; on the local configuration Gas
   Engineer, Fifth Engineer, Motorman, Wiper and both cadets have no category and are reported as unclassified. Should the
   Company tab on dev be completed, and are Electrical Officer = engineer and Deck Cadet = deck officer intended (as in your
   screenshot)?
4. **Appraisal scores** (B6): section 7.
5. **"Crew on board" report** vs the chatbot (A1): the report lists people not yet signed on; the chatbot does not. Align or
   leave?

---

## 10. Versions

| Item | Value |
|---|---|
| Crewing (local only) | `feature/assistant-livedata-trial`: `bf7f6bac` (rules + fixture v2 + expected results) → `cce736a6` (run-1 results, harness corrections) → final results commit, see section 8 — worktree `C:\Users\GhaziAnwer\crew\wt-livedata-trial` |
| Assistant (local only) | `feature/crewing-livedata-trial`: `0e023ea84` (rules + breakdown line) → `598ee24ad` (both-kinds wording, unclassified-rank line) → **`54b0e1beb`** (guard: licence-only needs the user's words) — worktree `TechnicalMoudle/.wt/crewing-trial` |
| Pilot image / container | **`sail-assistant-py:crewtrial-54b0e1beb`**, container `sail-assistant-py-crewtrial` (:8062, host network, query-state guard + masking memory ON); kept stopped for rollback: `-v2r2` (598ee24ad), `-v2r1` (0e023ea84), `-r3final` (812530d2c) |
| Local trial servers | `:6100` single (crew_trial_a, issuer crewing-pilot) · `:6101` multi-tenant (crew_trial_master → a / b / c, issuer crewing-pilotmt); launcher in the session scratchpad; as-of 2026-11-01 |
| Tunnel | forward 18062, reverse 16100 / 16101 |
