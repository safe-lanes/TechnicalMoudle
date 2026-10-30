# Crewing chatbot — Sagar's dev examples reviewed against the accepted rules and the two-area pilot (30-Oct-2026)

Source: `Crewing-Chatbot-Business-Rules-Questionnaire_examplefromdev.docx` (Sagar, 30-Oct-2026) — the questionnaire copy with
the example boxes filled in and two screenshots of a crew member's "Documents & Training Expiry Details" page on dev. The
questionnaire text and ticks are identical to Sahil's copy of 29-Oct; the only additions are the examples. Read-only
review; no code, fixture or data change; nothing run on dev. The older "today (provisional)" wording in the questionnaire is
superseded by Sahil's decisions (see `CREWING-STAGE2-SAHIL-DECISIONS-2026-10-29.md`) and does not reopen them.

## 1. Short version

1. **Already covered.** Every scenario the examples show is in the pilot's rules and checks: named crew on board of a
   vessel, licences and training certificates of one person with several expiring in the same weeks, the same certificate
   name held by many people (people vs documents counts), documents with an issued date but no expiry date (reported as
   "not included", never silently dropped), name search such as "GMDSS" / "CoC", rank text as stored.
2. **No new scenario needed a fixture.** Nothing in the examples contradicts a decided rule or reveals a case the isolated
   pilot does not already exercise, so no fixture was added and no suite re-run (the local copy already holds 23 GMDSS
   licences across 22 people and 51 documents without an expiry date, exercised by the committed checks).
3. **Reserved for dev acceptance** (not verified locally; dev was not read): "Vessel 8" on board includes Saad Hamid
   (Master) and Ali Waqas (Chief Officer); their licence / training expiry dates and the windows they fall into are
   recorded in section 3 with the filters to use. The screenshot date is not stated, so the as-of date must be fixed on the
   acceptance day.
4. **Out of scope confirmed.** The screenshots also show passports and seaman's books. Those live in a separate table
   (`crew_documents`, "C1 Travel and Identification Docs"), which the chatbot's documents tool never reads (it reads only
   `crew_licenses` and `crew_training_courses`; the local copy's licences table holds no travel document). No support added;
   no numbers recorded here, in fixtures or in Git.
5. No clarification needed; review closed.

## 2. Scenario check — examples vs the pilot

| What the examples show | Rule | Where the pilot already covers it | Verdict |
|---|---|---|---|
| Two named crew on board "Vessel 8" (Master, Chief Officer) | A1 (Vessel-screen rule) | C01/C02, direct A1–A3, Q01–Q02 on A/B/C | covered |
| One person with 4 documents expiring in Nov–Dec (licences + training) | A2 both kinds; A4 expired with expiring, both counts | C07, C20, D7, D13b (people vs documents); breakdown line | covered |
| Same certificate (GMDSS) expiring the same day for two people | people ≠ documents | C06, D1, Q07; local copy: 23 GMDSS licences / 22 people | covered |
| Training courses with issued date but **no expiry** (3 rows) | "excluded" counts, mentioned in the answer | D3 `noExpiryDate`, C05 regex "(unreadable|missing|not included)"; local copy 51 such rows | covered |
| Abbreviation differs from the name (COC_DM / COC Master) | name search on certificate_document, else abbr | D9 ('fire'), documentNameContains rule | covered |
| Licences identified by an ID column (LIC007 …) | not an input to the chatbot | — | n/a |
| Dates shown as 11-Nov-2026 (screen format) | stored text must be YYYY-MM-DD to be read; others → "unreadable" | D3 `unreadableExpiryDate` (fixture 31/12/2026) | covered; dev storage format to be confirmed on acceptance (if dev stores dd-MMM-yyyy, the rows count as unreadable and the answer says so) |
| Passport / Seaman's Book rows with expiry dates | A7 — never; separate table | not read by the tool | out of scope, confirmed |
| Vessel named "Vessel 8" | exact name match first, then unique partial | U2/U6 (ambiguous), C12 | covered; note "Vessel 8" would be ambiguous only if a second vessel name contains "Vessel 8" |

Environment differences noted, not defects: dev rank settings (Sahil's Company-tab screenshot) differ from the local
Company tab; dev vessel names differ from the fixtures. Both are configuration/data, handled per company by the rules.

## 3. Examples kept for dev acceptance (filters and dates; results NOT verified locally)

As-of date: not stated in the document — fix it on the acceptance day (the pilot pins 2026-11-01; dev will use its real
date, so windows below are given relative to the as-of date D).

**Crew on board**
- Question: "Who is on board Vessel 8?" → filters: vessel "Vessel 8", on board (primary + signed-on secondary), unit people.
- Expected to include: Saad Hamid (Master), Ali Waqas (Chief Officer). Full count and other names: from the Vessel screen on
  the acceptance day.

**Licences / training certificates** (dates from the screenshots; document numbers deliberately not recorded)
- Saad Hamid (Master): COC Master 20-Nov-2026; GMDSS 11-Nov-2026; Advanced Fire Fighting 10-Dec-2026; Advanced Training for
  Oil Tanker Cargo Operations 15-Dec-2026; two training rows (chemical, liquefied gas) with **no expiry**.
- Ali Waqas (Chief Officer): COC Chief Mate 25-Nov-2026; GMDSS 11-Nov-2026; Personal Survival Techniques 25-Nov-2026;
  Proficiency in Survival Craft & Rescue Boats 18-Nov-2026; one training row (fast rescue boats) with **no expiry**.
- Questions and expected shape (with D = 1-Nov-2026 as an illustration):
  - "Which certificates of crew on board Vessel 8 expire in the next 30 days?" → window D … D+30 (1-Dec): Saad 2 (GMDSS, COC),
    Ali 4 (GMDSS, PSCRB, PST, COC) = 6 documents / 2 people **plus** any already-expired documents of on-board crew (A4),
    reported separately in the breakdown line; "excluded: N without an expiry date" must mention the no-expiry rows.
  - "… in the next 60 days?" → window to 31-Dec: Saad 4, Ali 4 = 8 documents / 2 people (+ expired as above).
  - "Which crew hold a GMDSS certificate expiring this month?" → documentNameContains "GMDSS": 2 documents / 2 people.
  - "Only the ones not yet expired" → expiryState not_expired removes the expired part.
- Acceptance rule (unchanged): the chatbot's answer is compared with the Crewing screen on the acceptance day; a difference is
  reported to Sahil/Sagar, never resolved by choice.

## 4. What was and was not done

- Done: document dumped (text, highlights, comments, four images); screenshots read; scenarios mapped to the committed
  checks; schema check that travel documents are a separate table never read by the tool; local-copy counts for the two
  scenario types (read-only query on `crew_management_local`).
- Not done, on purpose: no fixture change, no suite re-run (nothing new to exercise), no dev access, no passport/seaman's
  book support, no numbers recorded.
