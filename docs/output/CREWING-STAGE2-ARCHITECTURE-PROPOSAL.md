# Crewing assistant — Stage 2 live data: architecture proposal

21-Oct-2026 · for Ghazi and Astra to evaluate · **proposal only: no code, push, merge, deploy or live change**

This replaces the "5 fixed tools" plan (`CREWING-STAGE2-IMPLEMENTATION-PLAN.md`, rev 2). The security chain, refusal rules (401 vs 200 `ok:false`), isolation tests and rollout gates from rev 2 are kept.

**Evidence labels:**
- **READ** = from code at `crewing_accounts` @ `587a795ddd7aa11e832fd61664f853906c66859e` and the assistant at `feature/chatbot-enterprise` @ `12f2aef44`;
- **PROVEN** = tested earlier (stated where so);
- **ASSUMED** = not verified.

**Pilot not used:** this is an architecture proposal, and nothing was built to run. Every Crewing finding below is READ.

---

## 0. Short version

1. **Recommended: a hybrid "dataset query" design.** There are about 7 data areas (crew, assignments, documents, vessels, rest hours, rotation plans, appraisals).
   - Each area is one tool. The model fills in a **structured, validated query**: filters, list/count/group, date window, sort, paging.
   - Crewing's server turns that query into SQL using **one shared library of business definitions** ("on board", "expired", "relief due"…).
   - The model never writes SQL. Every field, operator and grouping must be on an approved list.
2. **What it covers:** most everyday questions in those areas, in any wording, including combined filters, counts, "by vessel/rank" breakdowns, comparisons and follow-ups. No new endpoint is needed for each new wording.
3. **Where it reuses Crewing:** the 33 existing reports supply the queries and joins. The definitions are taken from the screens. They are **not** copied from the reports, which disagree with each other: four rules for "on board", three for "terminated" (READ).
4. **Correctness:**
   - totals and groups are always counted in the database over the **full** filtered set, never from the rows shown;
   - each answer states its definition and the as-of date;
   - property tests check count = list total, and the group sum = the count;
   - domain-approved examples are the reference.
5. **Domain team:** only **7 narrow decisions** remain, where the code genuinely conflicts or is silent (§7). Everything consistent in code is derived without asking.
6. **Effort:** about **13.5–17.5 working days** for all 7 areas; phase 2a alone (4 areas) ≈ 9–11. The rev-2 plan was 5.5–8 days for 5 questions.
7. **Two corrections to my earlier plans:**
   - "No assistant code change" was **wrong**. Its live-data instructions are written for PMS (work orders, running hours), so Crewing needs its own instruction block, a small assistant release (§4.1).
   - The masking that hides names from the AI provider only recognises certain field names, so Crewing's results must use them (§4, item 6).

---

## 1. What Crewing already has (capability map, READ)

Framework (`server/v2/reports/`):
- 33 report handlers; zod filters; `{rows, total}`; `page`/`pageSize ≤ 500`.
- All handlers are read-only SELECTs.
- The framework has **no** generic grouping, no user context, no permission per report and no vessel scope.

| Area | Reusable today | Conflicting or missing |
|---|---|---|
| **Crew (people)** | `crew_members_v2`; `cp-active`, `cp-on-leave`, `cp-available-to-join`, `cp-terminated`, `cp-not-for-rehire`, `cp-by-rank`, `cp-by-nationality` (DB-side group); `calculateCrewStatus` (`shared/crew-mapping.ts:16`): On Board / On Leave / Inactive / Terminated | **"Terminated"** is matched 3 ways (`='Terminated'`, `ILIKE 'Terminated%'`, `is_active=false`). On-leave and available-to-join use different rules. Ranks are not normalised (`_1` suffixes). Termination date filters do a raw cast, so one bad date fails the whole report (500). |
| **Assignments / on board / relief** | `vessel_planning_v2` (crew_status primary/secondary, sign-on, relief_due, sign-off, joining/relief status); `vsl-crew-on-board`, `cp-contract-expiry`, `rot-overdue-relief`, `rot-planned-sign-ons`, `rot-planned-reliefs`, `vsl-crew-changes`; the Due Crew screen (`dueCrewService`, in memory) | **On board has 4 rules.** The canonical one is the Vessel screen count (`vesselCrewCountController.ts:12-31`); `vsl-crew-on-board` applies **no** conditions. "Contract expiry" really means relief_due. Relief due is in days (reports) vs months on contract end (Due Crew screen). An empty-string sign-off is treated two ways. |
| **Documents** | `crew_licenses` (with `archived_at`), `crew_training_courses`: `trn-certs-expiring`, `trn-training-expiring` | Archived licences are listed, expired and expiring items are mixed, archived/terminated crew are included. **No report** for `crew_documents` (passports etc.), `crew_visas` or `crew_pre_joining_medicals` (tables exist). |
| **Vessels** | `master_vessels`; `vsl-manning-status`, `vsl-vacancies` (DB-side group) | Grouped by vessel **name** (no-name vessels merge); inactive/deleted vessels are not excluded; the rank filter differs from crew-on-board. |
| **Rest hours** | `rh-compliance-summary`: page plus the **live** recount the RH Overview uses (rest mode, OPA off); `rh-violations` (monthly = **stored** totals; date path = in-memory loop) | Stored vs live counts disagree. `vsl-compliance-summary` uses stored counts and status. The screen lets the user change mode/OPA; the reports fix them. |
| **Rotation plans** | `rotation_drafts_v2.plan_status`, `rotation_entries_v2.proposal_status`; Approvals screen logic (`rotationDraftsService.getProposals`) | No report. That screen's filter has a `JSON.parse` bug (READ). |
| **Appraisals** | `appraisal_results_v2`; `appr-pending`, `appr-scores-summary` | "Pending" includes `draft`. Vessel is free text. Ratings are text with a raw cast (one bad value → 500). No crew join, so archived/terminated crew appear. |
| *Out of first scope* | recruitment (7 reports), promotions, drug & alcohol (in-memory), contact details | contact details, D&A, medical and doctor visits are **sensitive** (§4.5) |

**Every business date is stored as text** (READ, schema). The shared `dateExpr` turns any non-`YYYY-MM-DD` text into NULL, and the reports then drop those rows silently.

**Incidental security finding (outside this work; READ, untested):** `POST /api/v2/reports/run` has **no role or vessel check**. Any logged-in user, including a Ship user, can run any report for any vessel, including `cp-contact-details` (mobile, email). The assistant design below does **not** reuse that route. I recommend raising it with Datta separately.

---

## 2. Three architectures compared

| | **A. Reusable tools over existing reports** | **B. Controlled query interface over approved views** | **C. Hybrid: dataset query tools + definitions library (recommended)** |
|---|---|---|---|
| How | ~15–25 tools, each wrapping one or two reports with fixed filters | One `query` tool: the model picks an approved view and sends a JSON spec (fields, operators, group, sort); the server compiles it to SQL | ~7 area tools with a typed query spec each, compiled over shared definition functions, plus 2 computed tools (rest-hours live count, Due Crew) and 2 lookups (vessel, crew name) |
| Coverage | Only the filter combinations each report has; questions combining reports need several calls merged by the model | Widest: any combination over the approved views | Wide within each area; cross-area conditions offered as **server-side filters** (e.g. documents `crewOnBoard=true`) |
| Correctness | Inherits each report's conflicting rule unless it's wrapped and corrected | Business meaning lives in the views; the model can still pick a wrong field (e.g. sign-on vs relief date) for a valid query | Meanings are named fields ("onBoard", "expiryStatus"), so the model picks a concept, not a column; one definition per concept |
| Safety | High (fixed code) | High if the compiler only takes approved names and parameters; larger surface to test | High: same compiler, smaller surface per area |
| Verification | Per tool | Combinatorial; hard to cover | Per area + property tests (count = list total, group sum = count) |
| Effort | ~10–14 d, and it grows with each question | ~15–20 d (views need migrations in each company's DB, which needs schema approval) | **~13.5–17.5 d**, no migration (views compiled in code) |
| Maintenance | New question → new tool | New field → view change + migration | New field → one registry entry + test |
| Main risk | Tool sprawl; the model picks among 25 similar tools | Model-built semantic errors; DB views drift per company | Registry design must be right first time |

**Why C:** it gives B's flexibility (combine filters, count, group) without database views or migrations. It also keeps A's safety: closed vocabularies, and code we control per area. The business definitions get **one home**, which none of the existing reports provide.

**Not recommended:**
- **Unrestricted model-generated SQL:** it can't enforce definitions, sensitive fields or company scope reliably.
- **Wrapping `/reports/run` directly:** it has no access checks and the definitions conflict.

---

## 3. Recommended design (C) in detail

### 3.1 Tools (manifest)

| Tool | Purpose | Modes |
|---|---|---|
| `resolve_vessel` | name/code → vessel in this company; ambiguous → candidates | lookup |
| `find_crew` | name / emp no → crew candidates (name, rank, current vessel) | lookup (≤ 5 candidates) |
| `query_crew` | people: status (on board / on leave / inactive / terminated, as `calculateCrewStatus`), rank, nationality, not-for-rehire, availability date | list · count · group (rank, nationality, status, vessel) |
| `query_assignments` | on board, relief due/overdue, planned sign-on/off, crew changes in a period | list · count · group (vessel, rank) |
| `query_documents` | licences/certificates + training (v1); visas, travel docs, medicals later | list · count · group (vessel, document type, status, rank) |
| `query_vessels` | manning: filled/vacant positions, vacancies by rank | list · group |
| `rest_hours` | **computed**: live violations/NCs per vessel-month or crew-month, using the RH engine with mode/OPA | list · count · group (vessel, crew) |
| `query_rotation_plans` | plans and entries by status (awaiting approval = Proposed + Partially Approved) | list · count · group (vessel, status) |
| `query_appraisals` | appraisal status/date per crew/vessel; **no scores** in v1 | list · count · group |
| `crew_summary` | one person: status, current assignment, relief due, document status counts (no contact data) | detail |

That's 10 tools. Each has a **closed vocabulary**.

### 3.2 Query spec (same shape for every `query_*` tool)

```json
{
  "filters": [{"field": "onBoard", "op": "is", "value": true},
              {"field": "vessel", "op": "in", "value": ["MV Alpha"]},
              {"field": "expiry", "op": "within", "value": {"next": 60, "unit": "days"}}],
  "mode": "list | count | group",
  "groupBy": ["vessel"],
  "sort": {"field": "expiry", "dir": "asc"},
  "limit": 10, "offset": 0
}
```

- **Fields:** each area registry defines its fields (type, allowed operators, SQL expression from the definitions library, sensitive flag, groupable/sortable). Anything else is rejected (`ok:false, "field not available: …"`).
- **Operators:** `is`, `in`, `not_in`, `eq`, `contains` (names only), `before`/`after`/`between` (dates), `within` (`{next|last: N, unit: days|months}`), `gte`/`lte` (numbers).
- **Date windows** are resolved on the server against a single **as-of date** (company time zone, ASSUMED to be configurable). Days and calendar months are separate units and are never mixed.
- **Limits:** list ≤ 10 rows per call (offset for more); group ≤ 50 groups; at most 2 group-by fields; each call ≤ 5 s DB time.

### 3.3 Response envelope (every call)

```json
{ "ok": true, "area": "documents", "asOf": "2026-11-01",
  "definitions": {"expiryStatus": "expired = before as-of; expiring = within window (v1)"},
  "appliedFilters": [...resolved, e.g. vessel name as stored...],
  "mode": "list", "total": 37, "returned": 10, "nextOffset": 10,
  "rows": [...], "groups": null,
  "excluded": {"unparsableDate": 2} }
```

- `total` and `groups` are computed by **DB-side** `COUNT` / `GROUP BY` over the full filtered set, never from `rows`.
- `excluded` counts rows dropped because a date is not valid `YYYY-MM-DD`. They are reported, not hidden.

### 3.4 Combining conditions

- **Within one area:** any combination of filters (AND), e.g. on board + rank + vessel.
- **Across areas:** an approved **cross-area filter field**, joined on the server. For example, documents get `crewOnBoard` and `crewVessel`; assignments get `hasExpiringDocument`. The model never intersects two lists itself.
- **Comparisons** ("Alpha vs Beta"): one `group by vessel` call, or two counts. Both are full DB counts.

### 3.5 Definitions library (single source of truth)

One function per concept, used by every area and tested once:

| Concept | Rule | Basis |
|---|---|---|
| `onBoard` | the Vessel screen count rule: crew_status primary/secondary, not archived/deleted, sign-on set; plus no sign-off (`NULLIF(sign_off,'') IS NULL`) | `vesselCrewCountController.ts:12-31` + `_shared.ts noSignOffExpr`; see **D1** |
| `crewStatus` | `calculateCrewStatus` order: Terminated → Inactive → On Board → On Leave | `shared/crew-mapping.ts:16-32`; terminated per **D2** |
| `expiryStatus` | expired / expiring within window / valid; archived licences excluded; archived crew excluded | Vessel grid rule; window **D3** |
| `reliefDue` | per **D4** | Due Crew screen vs relief_due |
| `rhViolations` | live engine (`getViolationDates`, `calculateNCs`) with mode/OPA | RH Overview; defaults **D5** |
| `awaitingApproval` | plan_status Proposed / Partially Approved | Approvals screen (consistent in code, so no question) |
| `appraisalPending` | per **D6** | `appr-pending` includes drafts |

The existing reports are **not changed**. Aligning them to the library is optional later work for Datta.

### 3.6 Answer behaviour

- **Facts vs manual:**
  - live answers say they are **from Crewing data as of <date>** and name the definition used when it matters ("on board = signed on, not signed off");
  - how-to answers keep the manual's `Source:` line;
  - the two are never blended without saying which is which.
- **Zero vs unknown:** `total: 0` → "none". An unknown vessel or crew → "not found" (never 0). Ambiguous → list the candidates and ask.
- **Missing data:** `excluded` > 0 → "N records have an unreadable date and are not included".
- **Unsupported:** no field or tool fits → "I can't get that from Crewing data yet", plus what it can do. Never estimate.
- **Follow-ups:** the existing history rules apply. "Only engine ratings" means the same query with an added filter; "more" means the next offset.

---

## 4. Access control and reliability (every call)

1. **Authentication (401, no data):** service secret + signed identity (HMAC, ≤ 60 s, `iss` = instance). Unchanged from rev 2.
2. **Company:** from the verified identity's `tenantDomain` (copy Technical's proven `serviceTenant.ts` pattern; Technical PROVEN 19-Oct). Unknown or inactive → refused.
3. **Role and permission (200 `ok:false`):**
   - Office + Sail Admin, re-resolved on the server (as Stage 1);
   - **per-area menu view permission** (`adm_roleaccess_ac`), e.g. no Rest Hours permission → `rest_hours` is refused.
4. **Vessel scope:** office Sail Admin = all company vessels. If Ship users are added later, each area applies `master_users.vessel_ids` in the compiled WHERE clause.
5. **Read-only by construction:**
   - each call runs in `BEGIN READ ONLY` with `SET LOCAL statement_timeout = 5s`;
   - only the compiler emits SQL; values are always parameters.
6. **Sensitive fields:**
   - The registry marks each field. v1 **excludes**:
     - mobile, email and addresses;
     - passport, visa and certificate **numbers**;
     - DOB and appraisal scores;
     - drug & alcohol results, medical and doctor visits;
     - notes, wages.
   - **Masking contract:** output keys must be `fullName`, `vesselName` and `rank`, so the assistant's masker tokenises names before the AI provider sees them (`masking.py` recognises names only by key: READ). Tested with a known-answer case.
7. **Environment routing:** `crewing-dev` and `crewing-prod`, each with its own key, secret and URL; the issuer selects the instance (unchanged).

### 4.1 Assistant-side changes (correction)

1. **Crewing instruction block.** The current tool-loop text is PMS-specific (work orders, running-hours rules) (READ: `agent.py:317-363`). Add per-module rules for Crewing:
   - report `total`, never count the rows;
   - state the as-of date and definitions;
   - "not found" ≠ 0;
   - use cross-area filters instead of merging lists;
   - never estimate.
2. Nothing else changes in the assistant: tool loop (≤ 8 steps, 10 s per tool, 24 KB result cap), masking, history and widget are reused.
3. **Release:** a normal versioned release (new container, switch, previous kept), like v10. Technical answers must stay the same (regression check).

---

## 5. Coverage matrix (first release)

✔ = v1 · ◐ = needs a domain decision first · later = phase 2c · ✖ = not planned

| Area | List | Count | Group by | Date window | Cross-area filter | Detail |
|---|---|---|---|---|---|---|
| Crew status / pool | ✔ | ✔ | rank, nationality, status, vessel ✔ | availability ✔ | has expiring doc ✔ | `crew_summary` ✔ |
| On board / assignments | ◐ D1 | ◐ D1 | vessel, rank ◐ | sign-on, sign-off ✔ | doc status ✔ | ✔ |
| Relief due / overdue | ◐ D4 | ◐ D4 | vessel, rank | ◐ D4 | on board ✔ | ✔ |
| Planned joiners / sign-offs | ✔ | ✔ | vessel | ✔ | – | ✔ |
| Licences / certificates, training | ◐ D3 | ◐ D3 | vessel, type, status, rank | ◐ D3 | on board ✔ | ✔ |
| Visas, travel docs, medicals | later | later | later | later | later | later |
| Manning / vacancies | ✔ | ✔ | vessel, rank | – | – | – |
| Rest hours | ◐ D5 | ◐ D5 | vessel, crew | month(s) ✔ | on board ✔ | ✔ |
| Rotation approvals | ✔ | ✔ | vessel, status | created ✔ | – | ✔ |
| Appraisal status | ◐ D6 | ◐ D6 | vessel, rank, status | appraisal date ✔ | – | ✔ |
| Appraisal scores, D&A, contact, medical | ✖ (sensitive; D7) | | | | | |
| Recruitment, promotions | later | | | | | |

---

## 6. Example question flows

| # | Question | Tools and spec | Status |
|---|---|---|---|
| 1 | "Who is on board MV Alpha?" | `resolve_vessel` → `query_assignments` {onBoard, vessel, list} | ◐ D1, then ✔ |
| 2 | "How many engineers are on board across the fleet?" | `query_assignments` {onBoard, rankGroup: engine, count} | ◐ D1 + rank groups (D1) |
| 3 | "Which on-board officers have certificates expiring in the next 60 days, by vessel?" | `query_documents` {crewOnBoard, rankGroup: officers, expiry within 60 days, group: vessel} | ◐ D3 window unit |
| 4 | "…and show me Alpha's list" (follow-up) | same spec + vessel = Alpha, list | ✔ (history) |
| 5 | "More" | same spec, offset 10 | ✔ |
| 6 | "Compare overdue reliefs Alpha vs Beta" | `query_assignments` {reliefStatus: overdue, vessel in [A, B], group: vessel} | ◐ D4 |
| 7 | "Who's available to join as Chief Officer next month?" | `query_crew` {status: on leave, rank, availability within 1 month} | ✔ |
| 8 | "Rest-hour violations on Beta in September" | `rest_hours` {vessel, month 2026-09, mode/OPA defaults} | ◐ D5 |
| 9 | "Which rotation plans are waiting for approval?" | `query_rotation_plans` {awaitingApproval, list} | ✔ |
| 10 | "Tell me about John Smith" | `find_crew` → 2 matches → ask which → `crew_summary` | ✔ (clarify) |
| 11 | "What's Smith's phone number?" | sensitive field not in registry → refused | ✖ by design |
| 12 | "Crew wage cost on Alpha" | no area/field → "can't get that yet" | ✖ unavailable |
| 13 | "Visas expiring this month" | documents type visa not in v1 → "not available yet" | later |
| 14 | "How do I plan a relief?" | manual search (Stage 1 path) with `Source:` | ✔ (Stage 1) |
| 15 | "Who is on board MV Zeta?" (no such vessel) | `resolve_vessel` → not found | ✔ "not found", never 0 |

---

## 7. Genuinely unresolved domain decisions (for Sahil and Sagar, narrow)

Each decision comes with a recommendation; **everything else is derived from code**.

| # | Conflict found in code | Recommendation |
|---|---|---|
| D1 | **On board** has 4 rules. Does **secondary** crew_status count as on board? And for "engineers/officers": which ranks form each group? | Vessel screen rule (primary + secondary, signed on, not signed off); rank groups from the existing rank-group synonyms (appraisals) — confirm the list |
| D2 | **Terminated** is matched 3 ways | status starts with "Terminated" (covers UT/BT/Gen/NFR variants) |
| D3 | Expiry window: 30 days / 60 days / 2 calendar months; list expired separately? (already in the rev-2 questionnaire) | expired separately; default = the grid's 2 calendar months |
| D4 | Relief due: Due Crew screen (contract end, months) vs relief_due date (days) | Due Crew screen rule |
| D5 | Rest hours: live vs stored counts; default mode and OPA | live; rest mode; OPA as answered (rev-2 Q4) |
| D6 | Appraisal "pending" includes **drafts**? | exclude drafts (show them separately) |
| D7 | Sensitive data: is any of contact details / appraisal scores / D&A / medical needed in the assistant? | none in v1 |

Rotation approvals, planned joiners, manning, vacancies and availability are consistent in code, so **no question is needed** for them. The rev-2 questionnaire would be cut down to D1–D7 (one page), plus worked examples with expected answers.

---

## 8. Testing

1. **Compiler and security units:**
   - every 401 case and every `ok:false` refusal;
   - unknown fields, operators or groups rejected;
   - parameters only (an injection string as a value stays a value);
   - `READ ONLY` enforced (an attempted write in a test fails);
   - timeout returned as data.
2. **Definitions library:** one fixture per rule edge (empty-string sign-off, secondary, archived licence, non-ISO date → counted in `excluded`).
3. **Property tests per area** (randomised filter combinations on the fixture DB):
   - `count.total == list.total`;
   - the sum of groups == count;
   - paging through all offsets returns `total` distinct rows;
   - adding a filter never increases the total.
4. **Domain-approved examples** (primary): expected answers from Sahil and Sagar on a fixed snapshot, automated.
5. **Reference-screen comparison** (secondary): same snapshot; differences reported for a decision, not auto-resolved.
6. **Company isolation:** two real company databases (local multi-tenant, if it runs; else the dev two-company test is a **release gate**).
7. **Direct endpoint tests** without the widget (rev 2 §3.7).
8. **Assistant:**
   - the masking known-answer test (a crew name never reaches the provider);
   - a Crewing question set (the 15 flows above, plus paraphrases);
   - Technical regression (same answers as v10).
9. **Stage 1 regression:**
   - token tests (10);
   - the Reports page is unchanged (no report code touched);
   - full Crewing suite base vs branch (0 new failures);
   - tsc count unchanged.

---

## 9. Rollout (bounded by data areas, not by question count)

| Phase | Scope | Gate |
|---|---|---|
| 2a | Foundation (endpoints, security, compiler, envelope, lookups, definitions) + **crew, assignments, vessels, rotation plans** | domain D1, D2, D4; tests 1–7; dev acceptance |
| 2b | **Documents** (licences, training), **rest hours**, **appraisal status** | D3, D5, D6 |
| 2c (optional, separate approval) | visas, travel docs, medicals, recruitment, promotions | new definitions + sensitivity review |

**Adding a capability later:** add a field or area entry to the registry, a definition with fixtures, and property tests. No new endpoint, no assistant change, and the manifest updates automatically.

**Stage 1 stays unaffected:**
- separate routes;
- the token endpoint and widget are unchanged;
- the `crewing-dev` registration stays documentation-only until url + secret are added together.

**Rollback:** remove url + secret (back to manual answers), or redeploy the previous build. No database change anywhere.

**Order:**
1. Crewing build (Datta review, merge, deploy dev).
2. Assistant release (Crewing instructions, registration).
3. Dev acceptance.
4. Production only after a separate approval.

---

## 10. Effort (provisional; final after D1–D7)

| Work | Days |
|---|---|
| Endpoints, security chain, company selection (copy Technical pattern), read-only transaction | 2–2.5 |
| Query compiler + registry + envelope + lookups (vessel, crew) | 3–4 |
| Definitions library + areas 2a (crew, assignments, vessels, rotation) | 2.5–3 |
| Areas 2b (documents, rest hours, appraisals) | 2–2.5 |
| Assistant: Crewing instructions, masking contract test, release | 1–1.5 |
| Tests (property, examples, screen comparison, isolation, direct) | 2–3 |
| Dev support + acceptance fixes | 1 |
| **Total** | **≈ 13.5–17.5 days** (2a alone ≈ 9–11) |

---

## 11. Proven vs assumed

- **READ (code, this revision):**
  - the 33 reports and their rules, conflicts and defects (§1);
  - no generic grouping, no per-report access check;
  - dates stored as text;
  - `calculateCrewStatus`;
  - the assistant's PMS-specific instructions, key-based masking and tool-loop limits.
- **PROVEN earlier:** Technical's service-tenant selection and live-data tool loop through the same assistant (19-Oct, 160 = 160).
- **ASSUMED (to verify early in 2a):**
  - the model (current assistant model) fills a 10-tool structured spec reliably; to be measured on the pilot with the 15 flows plus paraphrases **before** the build is committed to;
  - Crewing's multi-tenant mode runs locally;
  - the dev URL is reachable from the AI server;
  - the company time zone;
  - real-data date formats (counted, not guessed);
  - Sail Admin menu grants on dev.
- **Would change the plan:** if the pilot spike shows the model choosing wrong fields or groups often, fall back to fewer, more specific tools (design A) for the weak areas.
- **Pending, not verified:** Stage 1 dev deployment and genuine-login test (Datta).

**Recommended first step after approval:** a 1-day spike on the pilot with the registry for two areas (assignments, documents) and the 15 flows. It measures whether the model fills the specs correctly before the full build.
