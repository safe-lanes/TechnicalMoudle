# Crewing chatbot — business rules to confirm

For **Sahil and Sagar Chadda** · prepared 28-Oct-2026 by support · **final, consolidated** (replaces revisions 1–3). One document, so we do not come back to you area by area.

## Why we are asking

In an **isolated pilot** (test data on a test server, not available to users), the Crewing chatbot has answered live questions from Crewing data, for example "who is on board MV X", "which engineers have certificates expiring in 60 days", "how many crew per vessel". Before this can be offered to users, every word must mean exactly one thing on the server. Where a Crewing screen already fixes the meaning, we use that. Below are only the points where the screens, reports or data disagree, or say nothing.

**You are confirming business rules, not listing questions.** Users can phrase questions any way they like; each answer is built from these rules. For every point you will see: what the chatbot does today (provisional, from the pilot), a short example, our recommendation, and the choice to make. Tick a choice or write your own. Part A takes about 10 minutes; Part B about 10 more.

---

## Part A — Needed now (the two pilot areas: crew on board; licence and training-certificate expiry)

### A1. Does a *secondary* assignment count as "on board"?

Some people carry a second, "secondary" assignment on another vessel (for example a Third Engineer also listed on a second ship). The Vessel screen crew count includes them; the "Crew on board" report has no rule and also lists people who have not signed on yet.

- **Example:** Faustin is primary on MV Alpha Star and secondary on MV Beta Ocean. Counting secondary: Beta Ocean has 7 on board. Not counting: 6.
- **Today (provisional):** counted, as on the Vessel screen.
- **Recommendation:** count them, and let the user say "primary only" when they want to exclude them.
- **Choice:** ☐ A — secondary counts as on board (recommended) ☐ B — primary only

### A2. What does "certificates" include?

Crewing keeps two kinds of document: licences/certificates (CoC, endorsements, GMDSS…) and training-course certificates (Basic Safety, Advanced Fire Fighting…).

- **Example:** "How many crew have a licence or certificate expiring in 30 days?" → 4 crew counting licences only; 7 counting both.
- **Today (provisional):** both kinds, unless the user names one ("licences", "courses").
- **Recommendation:** both kinds; "licence" / "CoC" alone means licences only; "training" / "course" alone means training only.
- **Choice:** ☐ A — "certificates" = both kinds (recommended) ☐ B — licences only

### A3. "Expiring soon" with no period given

- **Example:** "Which certificates are expiring soon?" From 1 November, 60 days ends 31 December; 2 calendar months ends 1 January — different lists.
- **Today (provisional):** the chatbot asks which period; when the user gives one it is used exactly.
- **Recommendation:** keep asking (no silent default), unless you prefer one fixed default.
- **Choice:** ☐ A — ask (recommended) ☐ B — default 30 days ☐ C — default 60 days ☐ D — default 2 calendar months

### A4. Expired documents

- **Example:** "Certificates expiring in 60 days" — should a CoC that expired last week be in that list?
- **Today (provisional):** no; "expiring" = not yet expired and ending inside the period; "expired" is answered separately.
- **Recommendation:** keep them separate; the chatbot can give both when asked.
- **Choice:** ☐ A — separate (recommended) ☐ B — list expired together with expiring

### A5. Which ranks are "engineers", "officers", "ratings"?

The rank categories stored in Crewing are inconsistent (for example "Senior Officers" contains Able Seaman and Wiper), so the chatbot uses a fixed list:

| Group | Ranks |
|---|---|
| Deck officers | Master, Chief Officer, Second Officer, Third Officer |
| Engineers (engine officers) | Chief / Second / Third / Fourth / Fifth Engineer, Electrical Officer, Gas Engineer |
| Deck ratings | Bosun, Able Bodied Seaman, Ordinary Seaman, Pumpman |
| Engine ratings | Fitter, Motorman, Oiler, Wiper |
| Catering | Chief Cook, Messman |
| Cadets | Deck Cadet, Engine Cadet |

"Officers" = deck officers + engineers; "ratings" = deck + engine ratings; "engine crew" = engineers + engine ratings.

- **Example:** "How many engineers are on MV Beta Ocean?" → engine officers only: 4; with engine ratings as well: 5.
- **Today (provisional):** the table above; "engineers" = engine officers only.
- **Recommendation:** confirm the table; "engineers" = engine officers only.
- **Choice:** ☐ confirmed as shown ☐ changes (please mark them in the table): __________. Is the Electrical Officer an "engineer"? ☐ yes ☐ no

### A6. Are inactive or terminated crew included in document answers?

- **Example:** "Which CoCs expire in the next 60 days?" — a seafarer terminated last month still has a CoC on file.
- **Today (provisional):** archived licences and archived or deleted crew are excluded; crew on leave are included unless the user says "on board"; inactive and terminated crew who are not archived are **included**.
- **Recommendation:** exclude terminated crew; include inactive (they may be re-engaged). Terminated = status starting with "Terminated" (covers the UT / BT / General / NFR variants, which the reports match in three different ways).
- **Choice:** ☐ A — exclude terminated, include inactive (recommended) ☐ B — exclude both ☐ C — include both ☐ Terminated definition OK? ☐ yes ☐ no: __________

### A7. What an answer may show

- **Today (provisional):** name, rank, vessel; document name and expiry date; sign-on and relief-due dates; counts. Never: passport, visa and certificate numbers, date of birth, contact details, medical or drug-and-alcohol results, wages, appraisal scores.
- **Recommendation:** keep as is.
- **Choice:** ☐ OK as is ☐ remove: __________ ☐ add: __________

### Two expected-result examples per area (needed for acceptance)

Please give, from dev data, **two cases for each of the two areas** with the answer you expect, for example: "MV ___ on 1 November: on board = ___ people (names)"; "___'s CoC expires on ___ → in the 60-day list; ___'s training expired on ___ → not in it". We test the chatbot against **your** examples first; if a Crewing screen shows something different, we report the difference to you rather than choose ourselves.

- Crew on board: 1) __________ 2) __________
- Expiring licences / training: 1) __________ 2) __________

---

## Part B — For later development (not built yet; your answers now help to minimise further clarification later)

These areas are **not being developed now**; confirming the rules in advance reduces the questions we will need to ask when each area is built (your answers may still raise a follow-up or two). Where the Crewing code is already consistent we state the behaviour we propose and ask only for a tick.

### B1. Crew status and availability

- **Code today (consistent):** status is derived in one place as Terminated → Inactive → On Board → On Leave, in that order of precedence; "available to join" = on leave with an availability date.
- **Proposed:** "who is available to join as Chief Officer next month" = crew on leave, rank Chief Officer, whose availability date is **on or before the end of next month** — so someone already available today is included, not only people whose date falls inside next month; terminated crew never appear; "not for rehire" shown only when the user asks.
- **Example:** 3 Chief Officers on leave: one available since last week, one available on 15 November, one on 20 December. "Available next month" (November) → **2** (the one available now and the 15 November one). Counting only dates inside November would give 1.
- **Choice:** ☐ A — include people already available today (recommended) ☐ B — only availability dates inside the asked period ☐ change: __________

### B2. Relief due

- **Conflict:** the Due Crew screen works from contract end (sign-on + contract months, with the ± tolerance set there); the assignment also stores a separate relief-due **date**, and the overdue-relief report uses that date in days. The two can differ by weeks.
- **Example:** signed on 1 May, 6-month contract → due 1 November by the Due Crew rule; relief-due date recorded as 20 November → the report says not yet due.
- **Recommendation:** use the Due Crew screen rule (contract end) for "due" and "overdue", because that is what the office plans with; mention the recorded relief-due date only when it is different.
- **Choice:** ☐ A — Due Crew screen rule (recommended) ☐ B — recorded relief-due date ☐ C — show both

### B3. Rest hours

- **Conflict:** the Rest Hours overview recalculates live from the daily records; the monthly violation report uses stored monthly totals, and the two disagree after late edits.
- **OPA, explained:** "OPA 90" is the US Oil Pollution Act rule used for vessels trading to the USA. Switched on, it adds two work-hour limits on top of the normal rest-hour rules: no more than **15 hours of work in any 24 hours** and no more than **36 hours of work in any 72 hours**. Switched off, only the normal rest-hour rules apply. In Crewing the Rest Hours screen has an OPA checkbox (saved with each daily record, default off), and the overview follows that checkbox; **both rest-hours reports always count with OPA off**, whatever the checkbox says (verified in the code).
- **Example:** a record edited after month-end: the overview shows 2 violations, the stored monthly figure still shows 3. With OPA on, an engineer who worked 16 hours in one day gets one extra violation that the reports never show.
- **Recommendation:** live recalculation (same as the overview the master sees), rest mode; OPA off unless the user asks ("with OPA") or the vessel's records have the OPA checkbox ticked; always state the month and the date the data was last updated.
- **Choice:** ☐ A — live, rest mode (recommended) ☐ B — stored monthly totals ☐ OPA: ☐ off unless asked (recommended) ☐ follow the record's checkbox ☐ always on

### B4. Rotation approvals

- **Code today (consistent):** a plan is waiting for approval when its status is Proposed or Partially Approved; approval is recorded per entry.
- **Proposed:** "which rotation plans are waiting for approval" lists all such plans in the user's company (vessel, plan, created date, who is waiting), not only the ones assigned to the person asking; drafts are listed separately.
- **Example:** 5 plans Proposed, 1 Partially Approved, 2 drafts → "6 waiting for approval; 2 drafts not yet proposed".
- **Choice:** ☐ confirmed ☐ only plans waiting for the person asking ☐ change: __________

### B5. Vessel manning and vacancies

- **Code today (mostly consistent, two gaps):** a vacancy is a required position on the vessel's manning scale without a signed-on person. The manning report groups by vessel **name**, so vessels without a name are merged, and inactive or deleted vessels are not excluded; its rank matching also differs slightly from the crew-on-board count.
- **Proposed:** vacancies by vessel and rank, active vessels only, ranks matched the same way as "on board" (A1 and A5 apply); a position filled by a secondary assignment counts as filled.
- **Example:** manning scale 3 engineers, 2 signed on primary, 1 secondary → vacancies 0 (with A1 = A); 1 if secondary does not count.
- **Choice:** ☐ confirmed ☐ secondary does not fill a position ☐ change: __________

### B6. Appraisal status

- **Conflict:** the pending-appraisals report counts **drafts** as pending; the vessel on an appraisal is free text (typing differences split one vessel into two); archived or terminated crew still appear because there is no crew join.
- **Recommendation:** "pending" = submitted but not completed, drafts shown separately; match the vessel by its record, not by text; exclude archived and terminated crew (A6 applies). No appraisal **scores** in the chatbot (A7).
- **Example:** 4 drafts, 6 submitted-not-completed → "6 pending, 4 drafts".
- **Choice:** ☐ A — drafts separate (recommended) ☐ B — drafts count as pending ☐ scores never shown: ☐ agreed ☐ needed for: __________

### Expected-result examples for Part B (optional now, needed before each area is built)

One or two real cases per area, in the same form as Part A, whenever convenient.

---

*Everything marked "today (provisional)" is a trial setting, not an approved rule, until you confirm it. Nothing in this document changes Crewing screens or reports.*
