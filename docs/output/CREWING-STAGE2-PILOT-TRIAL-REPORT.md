# Crewing assistant — Stage 2 live data: pilot trial report

21-Oct-2026 · for Ghazi and Astra · **trial on the isolated pilot only: nothing pushed, merged, deployed or changed on live** · **revision 2:** round-2 corrections are in §11; §3 (widget trace) and §6 (cost) are corrected in place.

**Evidence labels:**
- **PROVEN** = run on the pilot, with output in the committed result files;
- **READ** = from code;
- **ASSUMED** = not verified.

**Pilot used:** yes, for everything below. The logins were signed test identities plus Crewing's **mock session** in the widget, **not** a genuine SAILERP login.

## 0. Short version

1. **The approach works.** Four reusable tools (two data areas plus two name lookups) answered the varied questions in a written-in-advance test set:
   - different wordings and combined filters;
   - people-vs-document counts, grouping and comparisons;
   - follow-ups and paging;
   - ambiguity, valid zero results and unknown values;
   - denied access and unsupported questions.

   The final two full runs passed **34/39** and **37/39** turns. **Held-out questions passed 10/10 in all four runs.**
2. **Counting is right where it matters.** Example: "engineers on MV Beta Ocean with certificates expiring in 60 days" → **2 engineers holding 5 certificates**. Totals are counted in the database over all matching records, not from the page shown. Those numbers were checked by 60 direct checks with hand-written expected values (all pass), and the check harness was shown to catch a deliberately introduced bug (9 checks failed).
3. **Access and isolation are enforced on the server and tested directly**, not just by hiding the button:
   - two real company databases plus an inactive one;
   - 401 for every bad credential;
   - "not allowed" for Ship users, wrong roles and missing menu permissions, checked for **every** data area a combined question uses;
   - read-only and timeout behaviour proven at the database level.
4. **Privacy: a real leak was found and fixed (PROVEN).** Follow-up turns sent the previous answer's crew names to the AI provider unmasked. With the fix (pilot setting), that dropped from 68 hits to **0** in three later runs. **Not fully masked:** names the user *types* still reach the provider (see §11.2 for exactly what remains visible).
5. **The failures are honest and few.**
   - Wording ambiguity: "licence or certificate", and "engineers" sometimes counting ratings too.
   - Two strict-scoring cases: the model gave a correct answer by a different route.
   - Three network hiccups in my test tunnel.

   I did not change any scoring. The fixes I made were found by development cases or the widget walk-through.
6. **Recommendation:** proceed to the wider build. The revised estimate is **≈ 9.5–12.5 working days** (was 13.5–17.5), because the foundation now exists. That depends on the 7 narrow domain decisions (questionnaire revision 3) and on Datta confirming Stage 1 on dev.

## 1. Exact versions

| Item | Value |
|---|---|
| Crewing trial branch (local only) | `feature/assistant-livedata-trial`, worktree `C:\Users\GhaziAnwer\crew\wt-livedata-trial`. Base `crewing_accounts` @ `5ce874904dbd` (latest, 21-Oct; the 2 newer commits touch only recruitment import). Commits `82bac160` → `e2c10a55` → **`2fade350`**. Existing checkout (`upgraded_crewing_architecture_v2` + 3 local changes) untouched. |
| Assistant trial branch (local only) | `feature/crewing-livedata-trial` off `feature/chatbot-enterprise` @ `12f2aef44` (= live v10 code). Commits `f3e68c5b4` → **`88f4ad9e2`** (code) → `8bb67d709` (regression probe script only). |
| Pilot assistant image | `sail-assistant-py:crewtrial-88f4ad9e2` (sha256:45907018a4a6…), container `sail-assistant-py-crewtrial`, 127.0.0.1:**8062**, env `~/central-assistant/crewtrial.env` (600). Not reachable publicly: nginx `assistant.sl-sail.com` still → v10 :8053 (checked after the trial). |
| Pilot Crewing | `:6100` single-company (DB `crew_trial_a`, mock session, issuer `crewing-pilot`); `:6101` multi-tenant (`crew_trial_master` → `crew_trial_a`, `crew_trial_b`, inactive `crew_trial_x`; issuer `crewing-pilotmt`). Keys only in `C:\Users\GhaziAnwer\local-only\crewing-livedata-trial.env` and the server env file. |
| Unchanged | Live v10, v9/v8 rollback containers, Technical, Audit, knowledge training, Stage 1 (`crewing-dev` stays documentation-only), all production systems. |

## 2. What was built (trial)

**Crewing** (`server/v2/assistant/`):
- `GET /api/v2/assistant/manifest` and `POST /api/v2/assistant/execute`. They are mounted **before** the browser-token middlewares and authenticated by service secret + signed identity. They are **not** added to the generic exempt list.
- **4 allow-listed tools with strict schemas:**

| Tool | Answers |
|---|---|
| `crewing_query_assignments` | Who / how many on board. **Unit:** people or assignments. **Modes:** list / count / group by vessel, rank, rank group, nationality, status. **Filters:** vessel, rank, rank group, nationality, sign-on and recorded relief-due windows, **hasDocument** (cross-area). |
| `crewing_query_documents` | Licences/certificates + training expiry. **Unit:** documents or people. **Modes:** list / count / group by vessel, type, name, rank, rank group, expiry month, expired/not. **Filters:** expiry windows in days or calendar months, expired/not, on board, vessel, rank, rank group, person. |
| `crewing_find_crew` / `crewing_resolve_vessel` | Name lookups. Several matches → candidates; none → "not found". |

- **Queries** are built from fixed SQL pieces plus parameters. There are no caller-supplied identifiers or SQL. Vessel and nationality names come from scalar subqueries, and on-board facts from `EXISTS`, so joins cannot multiply rows.
- **Every call** runs in one REPEATABLE READ READ ONLY transaction with a 5 s statement timeout.
- **Unknown or unparsable values:** an unknown vessel, rank or nationality is **refused as not recognised, never treated as zero**. Unreadable or missing dates are **counted** (`excluded`).
- **Definitions** live in one place (`livedata/definitions.ts`), each labelled CODE or PROVISIONAL.

**Assistant:**
- **Crewing instruction block:** units, quoting totals and never counting rows, one call per question, never a false zero, the "excluded" sentence, an as-of line, a provisional note, and a "Filters:" line that carries context into follow-ups. It shares the documentation rules with Technical; **Technical's text is byte-identical** (test).
- **`ASSISTANT_MASK_CONVERSATION_MEMORY`** (default **off**; on in the trial container) — see §5.

## 3. Results

Four full runs of the same 34-case / 39-turn test set (`scripts/assistant-trial/test-set.json`, written before run 1; 10 held-out turns). Raw results are in `scripts/assistant-trial/results/`.

| Run | Change | Turns | Held-out | Query · Data · Answer | Failed |
|---|---|---|---|---|---|
| 1 baseline | — | 34/39 | 10/10 | 33/37 · 31/35 · 37/39 | C06, C08, C27, C30, C31 |
| 2 | dev-case tuning (C27 rule, C06 wording) + masking memory on + refusal logging | 37/39 | 10/10 | 36/37 · 33/35 · 38/39 | C06, C08 |
| 3 final code | + empty-argument fix (widget finding) | 34/39 | 10/10 | 34/37 · 30/35 · 36/39 | C05 (network), C06, C08, C18.3, C20.1 |
| 4 repeat | same as 3 | 37/39 | 10/10 | 36/37 · 33/35 · 38/39 | C06, C08 |

Runs 3 and 4 use the same code, so the difference between them is model variation (C18.3, C20.1), plus one network failure.

### Failures, honestly

| Case | What happened | Class |
|---|---|---|
| C06 "crew with a **licence or certificate** expiring in 30 days" | The model counted **licences only**: 4 crew, correct for that reading. Expected 7 (licences + training). It persisted after a provisional tool-description change. | **Wording ambiguity → domain decision 2** |
| C18.3 "same for MV Beta Ocean" (engineers) | In run 3 "engineers" was mapped to engine officers **+ engine ratings**, so the Oiler was counted: "5 engineers" instead of 4. Run 4 mapped it correctly. | **Real inconsistency.** Fix in the build: a named `engineers` group on the server. Domain decision 5. |
| C08, C20.1 | The model answered via the assignments tool with a document filter instead of the documents tool. The answers were **correct**: crew per vessel 2/2/1, and Orrin + Petra. The pre-written scoring expected the documents tool. | Strict scoring, **kept as FAIL** (not re-scored) |
| C27 (run 1) | Asked for a wage, the model said the "documentation does not cover" it. Nothing was invented, but it mixed up manual and data. | Fixed by the "data the tools do not cover" rule (dev case). PROVEN from run 2 on. |
| C30, C31 (run 1) | The answers were correct refusals. My trial log missed refusals that happen before a tool runs. | **Instrument gap**, fixed; PROVEN from run 2. |
| C05, C06, C27 (network) | "fetch failed" from my laptop to the tunnel, 8–85 ms, three times in four runs. | Test-tunnel issue, not the product; counted as FAIL |

### Example conversations (run 4, final code)

| Question | Tool call (server-built query) | Answer (abridged) | Expected |
|---|---|---|---|
| How many engineers on MV Beta Ocean have certificates expiring in the next 60 days, and how many certificates is that? | documents · count · people · Beta Ocean · engine officers · on board · not expired · next 60 days → **documents 5, people 2** | "**2 engineers have 5 certificates** expiring in the next 60 days on MV Beta Ocean. 1 record has a missing or unreadable expiry date and is not included. … Filters: …" | 2 / 5 ✔ |
| List all crew on board across the fleet → "show more" | assignments · list · people · offset 0 → total 16; then offset 10 → 6 rows | "16 crew members … held in 17 assignments. The first 10 are: (table)" → next answer lists the 6 Beta Ocean crew | 16, 6 more ✔ |
| Which crew on board have a certificate expiring within 30 days? (held-out) | documents · list · people · on board · next 30 days → 5 / 5 | Table: Benedek, Aldric, Orrin, Tamsin, Petra | 5 named ✔ |
| Who is on board Alpha? | → `vessel_ambiguous` (2 candidates) | "Which vessel do you mean: MV Alpha Star or MV Alpha Trader?" | ask ✔ |
| Who is on board MV Zeta? | → `vessel_not_found` | "I couldn't find a vessel named 'MV Zeta'…" (not "0 crew") | not-found ✔ |
| Anything expiring soon? (held-out) | no data call | "Which period should I use … 30 days, 60 days, or 2 months?" | clarify ✔ |
| Same question, Ship user | → `not_allowed` | "…your role does not have permission to view it." No names. | refusal ✔ |
| Company B: on board MV Alpha Star | B's database → 4 | "4 crew members are on board MV Alpha Star." (company A has 8) | isolation ✔ |

**Widget (mock session, PROVEN, screenshots in `docs/output/crewing-trial-evidence/`). Corrected in round 2: these were two separate conversations, and the first version of this paragraph merged them.**

Trace from the Crewing call log (UTC):

| Session | Time | Turn | Result |
|---|---|---|---|
| 1 | 10:29:48 | Beta Ocean engineers, 60 days | 2 people / 5 documents |
| 1 | 10:30:07 | "show them as a list" (still **Beta Ocean**) | `invalid_args`: the model sent an empty `documentNameContains` |
| 1 | 10:30:17 | "same for MV Alpha Star" | **Alpha Star**, 0 |
| — | — | page reload (new conversation) | — |
| 2 | 10:35:13 | Beta Ocean engineers list question | — |
| 2 | 10:35:22 | "show them as a list" (**Beta Ocean**) | 5 certificates (`widget-list-followup.jpg`) |

There was no vessel-context error. The tested sequence did not cover "switch vessel, then show them / show more"; round 2 adds that regression (§11).

## 4. Correctness and completeness checks (direct, no model)

`scripts/assistant-trial/direct-checks.ts`: **60/60 PROVEN.** Expected values were written by hand from the fixture.

- **Counts:** on board by vessel / fleet (16 people, 17 assignments, one person with two); documents 18 / 14 people (archived licence and archived crew excluded); expired 2; expiring 30 days 7, 60 days 10, **2 calendar months 11** (1-Jan boundary); Beta Ocean engineers 5 documents / 2 people; valid zeros.
- **Properties:** sum of groups = total; count mode = list total; paging 4+4+2 = 10 distinct rows.
- **Unknown values:** vessel, rank ("Admiral") and nationality are refused; "Captain" = Master and "Indian" = INDIA resolve.
- **Injection and schema:** an injection string stays a value (documents still 18); limit > 10, unknown arguments or group keys and unknown tools are refused; empty optional values are ignored.
- **Read-only and timeout** (`readonly-timeout-check.ts`, PROVEN): a write inside the runner is rejected by Postgres (25006) with the count unchanged; a slow statement ends as a timeout, never as a result.
- **The harness itself was tested:** with the archived-licence exclusion deliberately removed, **9 checks failed**; restored, 58/58 again.
- **Lesson** (recorded): the first version of the direct checks passed 58/58 while the response envelope was wrong for the assistant's contract. The model received an empty tool result and answered "couldn't retrieve". Found by the first chat smoke test and fixed; an envelope contract check (X11) was added.

## 5. Access and privacy evidence

**Access (direct calls, PROVEN):**

| Check | Result |
|---|---|
| No / wrong secret; missing, tampered, expired (−200 s) identity; another instance's key; wrong issuer; domain-A identity with tuid-B; browser-style Bearer; manifest without secret | **401** |
| Ship user; a token claiming Sail Admin for a user whose stored role is "User" (server re-check wins); unknown user; inactive company X; unknown company; identity without company (multi-tenant) | **200 `ok:false`** (not_allowed / company_unavailable) |
| Per-area menus: role "External 1" (sees **CP Training Certificates** only) | Documents without vessel facts **allowed**, rows carry **no vessel**. Documents with an on-board filter, any assignments query, and a **combined** assignments + documents query → **not_allowed**. Every area a call touches is checked. |
| Company isolation, **two real databases** | Same vessel name: A sees 8, B sees 4; A asking for B's vessel → not found; B searching A's crew → 0 matches; B's own totals differ. Also through the assistant (cases C32–C34). |

**Privacy (complete outbound requests captured, synthetic names, `inspect_capture.py`):**

| Run | Where names appeared | Count |
|---|---|---|
| 1 (memory **off**) | **replayed history** (previous answer's crew and vessel names) | **68** |
| 2, 3, 4 and the widget session (memory **on**) | replayed history | **0** |
| all runs | tool results (rows, groups, errors, filters echo), system prompt, tool schemas | **0** |
| all runs | the user's **current** message (names the user typed, first model call of the turn) and the tool arguments the model wrote from them | still present (limitation) |

**Masking memory limits** (pilot setting, in-process):
- it is lost on container restart;
- a first name typed alone (e.g. "Petra") is not masked, because the masker matches full registered names only;
- vessel names in turns whose only tool call was refused are not learned.

## 6. Performance (pilot, gpt-5.6-luna)

| Measure | Runs 2–4 |
|---|---|
| Latency per turn | p50 **3.6–3.7 s**, p95 **5.5–5.9 s**, max 6.3 s |
| Model calls per turn | mean **≈ 2.0**, max 3 |
| Tokens per turn | ≈ **7,400 in** / 150 out (instructions + tool schemas dominate) |
| Cost | **UNVERIFIED (corrected in round 2).** The round-1 figure (≈ $2.6 / 1,000) scaled an earlier number whose rates were never verified, and is **withdrawn**. Measured tokens × rates: OpenAI's own price page could not be verified, and third-party trackers disagree, giving **$1.67** (at $0.20 / $1.20 per 1M) or **$8.36** (at $1.00 / $6.00 per 1M) per 1,000 turns. Confirm the contracted rate before using either. |
| Small-fixture timings (not production) | Crewing tool call 10–40 ms on 22 crew / 20 documents. Says nothing about production volumes; to be measured on dev data. |

## 7. Regression

| Check | Result |
|---|---|
| Technical tool-loop instructions | **byte-identical** to released v10 text (unit test). Pytest 99/99 (95 existing + 4 new). |
| Same documentation questions on the v10-code container vs the trial container | **Technical:** same path, same cited sources. **Crewing:** how-to content the same, but once live data is on, Crewing how-to answers go through the tool loop. The answer keeps its "Source:" line, but the **structured citations list is empty** (READ: the tool-loop response has no citations, same as Technical's live path). Widget source chips would disappear for Crewing how-tos. **Fixed in round 2** (§11.3): source chips PROVEN in the widget. |
| `/suggestions` Technical and Crewing | identical |
| Crewing Stage 1 token tests | 10/10 on the trial branch |
| Crewing TypeScript | 229 errors = baseline 229 (no new) |
| Live systems | v10 :8053 serving, nginx unchanged, public health 200 |

Not run: the full Crewing vitest suite base-vs-branch, because the trial adds new files and two mount lines only. It must be run before any merge.

## 8. What the code proves vs assumptions

- **PROVEN** (pilot): everything in §3–§7 on synthetic fixtures, mock login and signed test identities.
- **READ:** the definitions marked CODE match the Vessel screen rule; the tool-loop path drops structured citations.
- **ASSUMED / not tested:**
  - genuine SAILERP login (Stage 1 dev deploy still pending with Datta);
  - real Crewing data volumes and date formats: fixture query times say nothing about production;
  - the dev Crewing URL is reachable from the AI server;
  - Sail Admin menu grants on dev;
  - company time zone (trial pins as-of 2026-11-01);
  - model behaviour on other phrasings beyond the 39 turns.
- **Fixtures prove the logic handles these states**, not that they occur in production: secondary assignments, unreadable dates, archived licences.

## 9. Business decisions still open

Questionnaire **revision 3** (`CREWING-STAGE2-DOMAIN-QUESTIONNAIRE.md`). Provisional trial rules are not presented as approved.
1. Does a secondary assignment count as on board?
2. Does "certificates" mean licences + training? (C06)
3. "Expiring soon" without a period: ask, or a default?
4. Expired listed separately?
5. Rank groups, e.g. is the Electrical Officer an "engineer"? (C18.3)
6. Include terminated / inactive crew in expiry answers?
7. Which fields an answer may show.

Plus worked examples with expected answers. Relief, rest hours, appraisals and rotation are listed as later.

## 10. Recommendation and revised estimate

**Proceed** to the wider build after the decisions above, in the same shape: one tool per data area, a definitions library, a server-built query, and direct + chat + capture checks per area. The 7-area estimate drops because the foundation, test harness and assistant rules now exist:

| Work | Days |
|---|---|
| Harden trial code for merge: layering review, vitest instead of scripts, remove the trial log, Datta review | 1.5–2 |
| Apply domain decisions to the two trial areas + named `engineers` group | 0.5 |
| Remaining areas: crew status/pool 1 · vessels/manning 0.5 · rotation plans 1 · rest hours (live engine) 1.5–2 · appraisal status 0.5–1 | 4.5–5.5 |
| Assistant: citations on the tool-loop path, durable masking memory + first-name masking, smaller prompt (cost), widget intro text ("answers from manuals" is now wrong) | 1.5–2 |
| Per-area tests, domain examples, dev two-company gate, acceptance | 1.5–2.5 |
| **Total** | **≈ 9.5–12.5 working days** |

**Before any dev release:**
- Datta confirms the Stage 1 dev deployment and genuine login;
- the full Crewing suite base-vs-branch passes;
- the two-company check passes on dev;
- the masking-memory setting is approved for the shared assistant.

The trial resources stay up until you say otherwise:
- **AI server:** container `sail-assistant-py-crewtrial`, captures in `~/central-assistant-py/crewtrial-captures/`, env `crewtrial.env`;
- **local:** trial databases `crew_trial_*`;
- **tunnel:** forward 18062, reverse 16100/16101.

## 11. Round 2 (Astra review, 21-Oct-2026): targeted fixes and checks

Isolated pilot only: nothing pushed, merged or changed on live. Original scores in §3 are **unchanged**; this section adds to them.

### 11.0 Versions

| Item | Value |
|---|---|
| Crewing | `feature/assistant-livedata-trial` @ **`c7928015`** (on `2fade350`) |
| Assistant | `feature/crewing-livedata-trial` @ **`97115789d`** (on `8bb67d709`) |
| Pilot image | **`sail-assistant-py:crewtrial-97115789d`** (sha256:c3e90d4f023a…), container `sail-assistant-py-crewtrial` :8062, masking memory ON |
| Live | still v10 :8053; nginx unchanged |

### 11.1 Vessel context

**No context error (PROVEN from the call log; trace in §3).** The widget sequence was two separate conversations.

**New regression** (`test-set-context.json`, written before running), each conversation run twice:

| Case | Turns | Result |
|---|---|---|
| K01 | Beta engineers 60 d → "same for MV Alpha Star" (**zero**) → "show them as a list" → "show more" | Every follow-up kept **Alpha Star + engineers + on board + not expired + 60 days**. Every answer said none and never named Beta Ocean crew. |
| K02 | same pattern, non-zero | Alpha Star list = Aldric and Benedek; "show more" said there are no more. |
| K03 | "5 at a time", Beta → Alpha → "show more" | offset 5 on **Alpha Star**, 3 rows, no Beta names. |

- **Test-file defect (instrument, honestly reported):** the context file first saved every `\b` as a JSON backspace, so answer checks with word boundaries could never match. It was fixed. `rescore_answers.py` re-applied only the answer regexes to the **saved** answers; originals are kept as `r2-context-N.json`, rescored as `-rescored.json`.
- **Rescored:** 8/11 and 7/11. **All remaining failures are correct answers via another valid route.** The model used the assignments tool with a document filter, or reused the list already shown, where the scoring expected the documents tool. The exception is one over-specified expectation (K01.1 run 1: it answered "2 engineers" to a question that asked only for engineers, while the test also demanded the certificate count).
- **Drift found:** twice the model **added** an unrequested `crewStatus: primary` in a follow-up. The result was unaffected here, but it is drift. **Build fix:** reject or ignore filters that are not in the previous Filters line, unless the user named them.

### 11.2 Masking: memory isolation, fail-closed history, what remains visible

**Changes (assistant `97115789d`):**
- The memory key is **issuer + company + user + conversationId**.
- Every answered turn is recorded, including turns with no names.
- **Fail closed:** if a request carries history but there is no memory record for that exact key (restart, expiry, other user, company or issuer, reused or new conversation id), the earlier **assistant answers are withheld** from the model and replaced by a placeholder. The user's own earlier questions are kept.
- Crewing only: parts (4 letters or more) of a tool-returned person name are also masked, so a first name typed later is hidden.

**End-to-end** (`masking-checks.ts` + `inspect_capture.py --ranges`, complete outbound requests, synthetic names). PROVEN; the assistant log shows **5 withholdings** = S2–S6.

| Scenario | Earlier answers sent to model? | Names visible to provider |
|---|---|---|
| S1 normal follow-up (memory hit) | yes, **masked** | none |
| S2 container **restart** between turns | **withheld** | only the vessel name the user typed earlier |
| S3 **new conversation** carrying old history (also = **logout**: sign-out reloads the page → new conversation; READ, Stage 1 code) | withheld | user-typed vessel name |
| S4 **other user**, same conversation id | withheld | user-typed vessel name |
| S5 **other company**, same conversation id | withheld (and B's own data answered: 4 on its MV Alpha Star) | user-typed vessel name |
| S6 **other issuer** (same company, user, conversation) | withheld | user-typed vessel name (also in the model's tool arguments) |
| S7 first name typed **before** any lookup ("Is Petra on board?") | — | **"Petra"** |
| S7 same first name typed **after** the lookup returned "Petra Wintermarsh" | — | none (masked) |
| all scenarios: tool results (rows, groups, errors, filters), system prompt, tool schemas | — | none; tool results carried masked tokens only |

**Exactly what remains visible to the provider. The system is NOT fully masked:**
1. **Names typed by users** in the current message, before any tool in that conversation has returned them: person names (full or first names) and vessel names.
2. **Names typed by users in earlier turns**, replayed as the user's own history text.
3. **Tool arguments** the model writes from those typed names (e.g. `vessels: ["MV Alpha Star"]`, `find_crew {name: "Petra"}`).
4. A first name **shorter than 4 letters**, or one never returned by a tool.

**Smallest practical treatment for user-typed names (proposed, not built):** before the first model call, the assistant sends the user's message to the **same Crewing instance** (the data owner, not a third party), via a new allow-listed endpoint, e.g. `crewing_match_names(text)`. Crewing returns which substrings are crew or vessel names **of that company**, and the assistant registers them, so they are masked from the first call.
- **Limits:** only names that exist in that company's data are caught. Typos, people from other companies and unknown names still pass. A first name that is also a common word ("Will", "May") could over-mask. It adds one module call per message (tens of ms on the fixture). The user's text reaches Crewing, but it is Crewing's own data.
- **Alternative with fewer moving parts:** keep the current behaviour and state in the widget that typed names are sent to the AI provider. That is a product decision.

**Memory limits:** in-process and lost on restart. Restart is now **safe** (withheld), but follow-ups straight after a restart lose the previous answer. The model re-runs the query from the user's questions: S2 answered correctly, with 4 engineers. A durable store is optional for the build.

### 11.3 Manual citations and widget intro

- **Citations:** the Crewing tool-loop path now returns structured `citations` from `search_module_docs`. The same manual is cited as the v10 documentation path (regression probe). **PROVEN in the pilot widget:** five source chips (e.g. "Crewing User Manual R2 — 1.5.3.3 How to approve or reject a rotation plan (p.43)").
- **Technical unaffected:** the citations are added only when module = crewing; Technical's documentation answers show the **same sources** on v10-code and trial containers, and `/suggestions` are identical. Technical's own tool-loop path still returns no structured citations, as in v10; that is a separate, optional change.
- **Widget intro:** Crewing passes its own `intro` (no widget bundle change), PROVEN in the widget: *"Ask how to do something in Crewing — answered from the user manuals, with their sources. Or ask about current crew data … answered from Crewing data, with the date it applies to."*

### 11.4 Results classification (original scores unchanged)

Failed turns only (`summarize.py`). Hand corrections are marked †.

| Run | Infrastructure | Correct answer via another valid route | Wrong or incomplete answer |
|---|---|---|---|
| 1 | C06, C27 (tunnel) | C08; C30, C31† (correct refusals; my log missed early refusals) | — |
| 1 rerun | — | — | C06 (licences only), C27 (called it a documentation gap) |
| 2 | — | C08 | C06 |
| 3 | C05 (tunnel) | C08, C20.1 | C06, C18.3 ("engineers" counted an Oiler) |
| 4 | — | C08 | C06 |
| round 2 affected ×2 | — | C08, C20.1 (run a) | C06 (both) |
| round 2 context ×2 (rescored) | — | K01.2, K01.3, K02.1, K02.3 | K01.1† (over-specified expectation) |

- **Wrong answers left:** **C06 only** (certificate scope, decision 2).
- **C18.3 "engineers":** passed 2/2 after the named `engineers` group, but two runs do not prove it fixed.

### 11.5 Cost and timings

See §6, corrected. Tokens are measured (≈ 7,400–8,600 in / 150–200 out per turn). **Cost is unverified:** $1.67 or $8.36 per 1,000 turns at the two conflicting published rates. Fixture timings are not production expectations.

### 11.6 Business decisions

The questionnaire (revision 3) now states that the **seven decisions cover only the two trial areas**; every other area gets its own targeted list. Approved meanings are enforced as **one server rule each** (e.g. the named `engineers` group). The remaining limit is the model's reading of a user's wording (C06).

### 11.7 Checks run in round 2

| Check | Result |
|---|---|
| Direct checks | **61/61** (+A12 `engineers` group) |
| Assistant pytest | **103** passed (+5: key isolation, hit vs miss, withholding, name parts) |
| Crewing TypeScript | 229 = baseline |
| Context regression | §11.1 |
| Masking end-to-end | §11.2 |
| Affected original cases ×2 | 9/12, 11/12; C18.3 now passes; C06 still fails |
| Widget | chips + intro |
| Technical / Crewing documentation regression | §11.3 |

The full set was **not** repeated, as instructed.

### 11.8 Updated recommendation

- **Keep the architecture.**
- **Before extending to the remaining areas:**
  1. Sahil and Sagar answer the 7 decisions; decision 2 is the one wrong answer left.
  2. Decide on user-typed names: the pre-match endpoint (≈ 1 day) or a stated disclosure.
  3. Add the "no unrequested filters" guard.
  4. Datta confirms Stage 1 on dev.
- **Estimate** stays **≈ 9.5–12.5 working days**, plus ≈ 1 day if the name pre-match is chosen.
- Stopped here for review; the remaining data areas are not started.


## 12. Round 3 (Astra review, 28-Oct-2026): server-held query state; whole-conversation separation

Isolated pilot only: nothing pushed, merged or changed on live; no other data area added. Earlier sections and scores are unchanged.

### 12.0 Exact versions

| Item | Value |
|---|---|
| Assistant | `feature/crewing-livedata-trial` (local): `749527bcc` (round-3 build) → `876d1ef8a` (run-1 fixes) → **`b603c1d6c`** (run-3 fixes), on `97115789d` |
| Crewing | `feature/assistant-livedata-trial` (local): `0b9f068d` → **`e4758850`** — test sets, harness, results only; **no Crewing server code changed** in round 3 |
| Pilot image / container | **`sail-assistant-py:crewtrial-b603c1d6c`** (c12b1790ef5e), container `sail-assistant-py-crewtrial` :8062, `crewtrial.env` + `ASSISTANT_QUERY_STATE_GUARD=true`, masking memory ON. Earlier containers kept stopped for rollback: `-r2` (97115789d), `-r3a` (749527bcc), `-r3b` (876d1ef8a) |
| Live | v10 :8053 untouched; nginx unchanged |
| Local | Crewing :6100 / :6101 (same launcher, fixture as-of 2026-11-01), tunnel 18062 / 16100 / 16101 |

### 12.1 Item 1 — unintended filter changes are reduced by a server-side guard (not guaranteed prevented)

**Built (assistant `app/query_guard.py`, `mask_memory.py`, `agent.py`; setting `ASSISTANT_QUERY_STATE_GUARD`, off by default):**
- After every successful Crewing query the server stores the **validated** query (the `query` Crewing echoes after zod validation and vessel resolution), keyed by issuer + company + user + conversationId.
- The two query tools get an assistant-side parameter `conversation { basis: previous | new, unset: [...] }`; it is consumed by the server and never sent to Crewing. On `basis: previous` the server **merges**: every filter the model did not mention is retained; a filter it adds or changes is run only if the user's **current message** gives evidence for it (filter words such as "expired", "primary", "on board", or the value itself — a vessel or rank name the user typed); otherwise the call is refused with `filter_change_not_requested` and the model is instructed to **ask the user** instead of retrying. An explicit `unset` needs removal words ("all vessels", "regardless of rank"). `basis: new` on a message that reads as a follow-up ("same…", "them", "show more", "only…") is refused with `follow_up_needs_previous_basis`. A missing `basis` is inferred from the same cue words. Presentation keys (mode, unit, groupBy, sort, limit, offset) are never guarded, so "show them as a list" / "show more" change only those.
- Cross-tool follow-ups: shared filters (vessels, ranks, rank groups) carry over; an assignments question carries its on-board scope and any `hasDocument` condition into the documents tool and vice-versa; filters with no equivalent (e.g. `crewStatus` on the documents tool) are reported to the model as `previousFiltersWithNoEquivalentHere`, so it can say so instead of inventing ids.
- Consistency: "the expired ones" after a "next 60 days" question drops the future window (a document cannot be both expired and expiring next); `crewStatus: [primary, secondary]` is treated as no filter; `crewIds` must be UUIDs from `crewing_find_crew` (a placeholder is refused).
- The result tells the model `conversationBasis` and `filtersKeptFromPreviousQuestion`; the answer's "Filters:" line is written from the query that actually ran.

**Fixture where primary-only differs (direct, no model, PROVEN 12/12 — `r3-fixture-probe.ts`):** engineers on board MV Beta Ocean = **4** people (Orrin, Petra, Quillon primary + Faustin secondary) vs **3** primary-only; fleet engineers 7; everyone 16; MV Alpha Star 8 (5 + 3 when paged); MV Gamma Bay 0; the round-2 document counts unchanged (2 people / 5 documents; Alpha Star 0).

**Chat runs (`test-set-context-r3.json` = set A, written before run 1; `test-set-context-r3b.json` = set B, written after run 1 and before run 2: same questions and the same retained-filter expectations, plus the equivalent assignments-tool route accepted for document questions). Scoring is on the args Crewing RECEIVED; `argsAbsent` fails a turn if a listed filter was present in any successful call.**

| Run | Build | Score | What failed |
|---|---|---|---|
| 1 (set A) | 749527bcc | 11/18 | 4 × correct answer by the other tool route (set A expected the documents tool); R02.4 guard over-strict (`crewOnBoard` after an assignments question) → model asked the user; R03.3 model did not declare the removal ("regardless of rank") → filter kept, model asked the user; R04.3 model wrote `crewStatus [primary, secondary]` on a new question (no effect on the result). **No silent filter change in any turn.** |
| 2 (set B) | 876d1ef8a | 17/18 → **18/18** rescored† | R01.1 = test-file defect (regex escape), answer correct |
| 3 (set B) | 876d1ef8a | 14/18 → 15/18 rescored† | R01.3 documents→assignments switch refused (translation missing); R01.4 "the expired ones" kept the 60-day window → 0; R02.4 model invented `crewIds: ["<primary-engineer-ids>"]` → 0 |
| 4 (set B) | b603c1d6c | 14/18 | 3 × transport ("fetch failed" on the local tunnel, 3–18 ms, request never reached the assistant); R02.2 = the designed consequence (first turn lost → history unverifiable → restatement asked) |
| 5 (set B) | b603c1d6c | **17/18** | R05.2 **missing information**: the three remaining crew were listed, but the answer did not state that 3 of 8 were shown (the model omitted the server total) — fixed in §13 |
| 6 (set B) | b603c1d6c | **17/18** | R05.1 **missing information**: five rows listed without "5 of 8" — the paged total was omitted — fixed in §13 |

† `rescore_answers` logic re-applied only the R01.1 answer regex after fixing a backslash-escape defect in set B (the same `\b` class of defect as round 2, this time introduced by a shell heredoc); originals kept as `r3-context-N.json`, rescored as `-rescored.json`. Query/data scores untouched.

Fixes between runs (all in the assistant, each with a unit test): on-board scope and `hasDocument` ⇄ document-filter translation across the two tools; expired drops a future window; placeholder `crewIds` refused; both-status `crewStatus` = no filter; unset examples in the instructions. After the fixes, scenarios R01–R06 (vessel change, zero result, list, "the expired ones", primary-only probe, explicit removal of vessel and of rank, genuinely new question, paging) passed in two consecutive runs except the paging total, which the model omitted once in each run — that is missing information, not a harmless wording difference, and is addressed in §13.

**The round-2 drift, caught once (PROVEN, regression set C18.3 on build b603c1d6c):** the model added `crewStatus: primary` on "same for MV Beta Ocean"; the guard refused (`violations=['unrequested_change:crewStatus']` in the assistant log) and the model asked the user instead of giving a silently narrowed number. **Its wording was wrong**, though: it said *"the previous query's primary-crew filter was retained"* — the filter was never in the previous question; the model had just introduced it. Corrected in §13 (the refusal now states that the condition was not part of the previous question). Over 110 guarded calls on that build, the only refusals were that one and one placeholder-`crewIds` call. The guard reduces unintended changes; it cannot prove the model's intent (see 12.5).

### 12.2 Item 2 — whole conversation histories are separated

**Built (assistant `mask_memory.py`, `chat.py`):** conversation state (masking memory + query state) is bound to issuer + company + user + conversationId, with an ownership index conversationId → key. When a request carries history and the state for that exact key is missing (restart, expiry, new or reused id) or the id is **held by another identity**, **both** the earlier user questions and the earlier assistant answers are discarded before any model call (round 2 only withheld the answers). The model receives a session note (answer only the current message; if it depends on earlier context, ask the user to restate — never guess); the user sees a notice naming the reason ("could not be verified for this session, for example after a service restart" / "belongs to a different session or user"); the response carries `historyDiscarded: unverified | other`. A conversation id held by another identity is never adopted: nothing is remembered under it for the second identity, so the owner's later turns still hit. Logout: the widget starts a new conversation on sign-out (page reload; READ, Stage 1 code) — such a request is the T7 case.

**Proof on the complete outbound model requests (`masking-checks-r3.ts` → capture lines 678–710, `inspect_roles.py`), synthetic names in BOTH the user question ("Which certificates does Petra Wintermarsh hold…") and the assistant answer of the presented history. PROVEN:**

| Scenario | Requests | History sent to provider (user / assistant msgs) | Synthetic names on the wire | Notice |
|---|---|---|---|---|
| T1 legitimate follow-up (state hit) | 3 | 3 / 3, **masked** | none | – |
| T2 restart inside the same conversation | 1 | **0 / 0** | none | unverified; model asked what to check |
| T3 another user, same id + history | 1 | **0 / 0** | none | other; model asked to restate |
| T4 the owner continues after T3 | 2 | 2 / 2, masked | none | – (still the owner's) |
| T5 another company (multi-tenant), same id | 1 | **0 / 0** | none | other |
| T6 another issuer, same tenant/user/id | 1 | **0 / 0** | none | other |
| T7 new conversation id carrying old history | 1 | **0 / 0** | none | unverified |
| T8 foreign identity, same id, no history | 2 | 0 / 0 | user-typed vessel name only | – (standalone answer; nothing remembered under that id) |
| T8 owner's next turn | 3 | 3 / 3, masked | none | – (still a hit) |
| every turn 1 | 3 | – | the user-typed "Petra Wintermarsh" in the **current** message | – |

What remains visible to the provider is unchanged from §11.2: names the user types in the current message (and in replayed legitimate history until a tool has returned them — here masked, because turn 1's tool result registered the name). User-typed name matching is **not built** (not approved); its benefits, limitations and overhead stay as documented in §11.2.

### 12.3 Regressions on the final build (b603c1d6c)

| Check | Result |
|---|---|
| Direct endpoint checks (no model) | **61/61** (unchanged) |
| Main test set (39 turns, round 1 scoring), two runs | run 1: **34/39, held-out 9/10**; run 2: **36/39, held-out 10/10**. In both: C06 (licence vs certificate wording — a definition question, A2 of the questionnaire), C08 / C20.1 (correct answer by the other tool route — harmless). Run 1 only: C09.1 (asked which vessel/type instead of querying fleet-wide — a missing answer, passed on the repeat) and C18.3 (the drift caught by the guard; the clarification's wording was wrong, see 12.1 and §13) |
| Round-2 context set (K01–K03) | 8/11 — the K01 turns used the assignments route with `hasDocument` (same classification as round 2: correct by another route; filters and the new vessel retained, including zero) |
| Shared documentation behaviour (v10-code :8061 vs trial :8062, same questions) | Technical: gate, cited sources and tools **identical**; Crewing how-to: same sources (tool path differs by design, as in round 2); `/suggestions` identical for both modules |
| Assistant unit tests | **116 passed** locally (`test_env_routing.py` skipped: `httpx` not installed in the local venv — the container has it); Technical tool-loop text byte-identical to v10 (test) |
| Privacy (round-2 scenarios S1–S7) | not re-run; the guard does not touch masking, and T1/T4/T8 show masked replay of hits |

### 12.4 Measured (tokens, not money)

| | round 2 | round 3 (runs 5, 6, main-2) |
|---|---|---|
| latency p50 / p95 | 3.6 s / 5.9 s | 4.0–4.2 s / 5.9–6.3 s |
| model calls per turn | ≈ 2 | 2 |
| input tokens per turn (mean) | ≈ 7.4 k | ≈ 8.6–8.8 k (the `conversation` parameter and the guard rules add ≈ 1.3 k) |
| output tokens per turn (mean) | – | ≈ 150–170 |

Monetary cost stays **unverified** until the applicable rate is established (no $ figure is given).

### 12.5 Remaining limitations (honest)

1. Evidence for a filter change is keyword- and value-based (English words); an unusual phrasing can be refused (the model then asks — the user answers in one more turn) and a word that happens to match can let a change through. Follow-up detection for a missing `basis` is cue-word based.
2. The model may still label a follow-up as `basis: new` when the message has no cue word; the guard then runs it as new. The instructions forbid it and no run showed it, but the server cannot prove intent.
3. A refusal costs a turn: the model asks the user rather than answering (C18.3, R02.4 run 1). That is the requested behaviour, not a silent answer.
4. Cross-tool translation covers the two trial areas only; each new area needs its mapping.
5. State is in-process: a restart resets every conversation (now safely, with a notice) — a durable store is a build-stage option.
6. Hostile reuse of a conversation id with a valid token of another identity gets standalone answers under that id (never the owner's history, never remembered); it cannot poison the owner's state.
7. `inspect_roles.py` and the harness depend on the capture seam and the SSH tunnel; three transport drops occurred in run 4 and two in the masking run (retried at the transport level only, never after a request reached the assistant).

### 12.6 Kept separate, as instructed

- User-typed name matching: **not implemented**; see §11.2 for benefits, limits, overhead and the current exposure.
- Questionnaire revision 3 for Sahil and Sagar: **unchanged and ready**; every provisional rule is still labelled provisional in `definitions.ts`.
- Cost: tokens reported above; rate unverified.
- Release requirements unchanged: Datta's genuine-login check on dev, realistic-volume testing, the full Crewing suite base-vs-branch, the two-company gate.

### 12.7 Expected vs actual, in one table

| Requirement (Astra) | Expected | Actual |
|---|---|---|
| Query state preserved on the server, not the "Filters:" sentence | state = validated query echo; follow-ups merged server-side | built; `filtersKeptFromPreviousQuestion` in results; 110 guarded calls logged |
| Follow-ups retain filters, change only what was asked; clarification when ambiguous | retained unless user asked; refusal → ask | R01–R06 passed twice (filters); C18.3 and R02.4 (run 1) show the ask — the C18.3 wording was inaccurate (fixed, §13) |
| No silent "primary only" / no silent drop | `argsAbsent` never triggered on the final build; omitted filters retained | observed in runs 5 and 6 and in the C18.3 refusal; reduced, not guaranteed (12.5 items 1–2) |
| Fixture where primary-only differs | 4 vs 3 | PROVEN by direct probe |
| Vessel change, zero result, show more, explicit removal, new question | R01, R03, R04, R05 | filters correct in both final runs; the paged total was omitted once per run (missing information, fixed in §13) |
| History bound to issuer+company+user+conversation; reject/discard both roles on identity change | 0 history messages sent | T3, T5, T6: 0/0 — PROVEN on the wire |
| Clear on logout / account change | new conversation id → unverified; other identity → other | T7, T3/T5/T6 |
| Restart in a legitimate conversation: reset + ask to restate | 0/0 + notice + restatement | T2 — PROVEN |
| Proof with synthetic names in questions and answers, full outbound requests | no names except user-typed current message | PROVEN (table 12.2) |
| Targeted tests + shared regressions; previous evidence preserved | unit 116; main 36/39; docs probe identical | done; §3–§11 untouched |
| No push / merge / live change / new data area | – | none |

**Trial resources still up (ask before cleanup):** container `sail-assistant-py-crewtrial` (b603c1d6c) + three stopped predecessors, build dirs `~/build-crewtrial-*`, captures (now 7xx lines), local Crewing :6100/:6101, tunnel, trial DBs.


## 13. Review items (Astra, 28-Oct-2026, after round 3): pagination, clarification wording, report corrections, env-routing tests, questionnaire

Isolated pilot only. No push, merge, live change or new data area. §12 wording was corrected in place (12.1 heading, run table, 12.3, 12.7): the guard **reduces** unintended changes, both main-suite results are shown (34/39 with held-out 9/10; 36/39 with held-out 10/10), and omitted totals are now classed as **missing information**, not wording.

### 13.0 Exact versions

| Item | Value |
|---|---|
| Assistant | `feature/crewing-livedata-trial` (local): `727602eb6` (pagination line + clarification wording) → **`812530d2c`** (primary-only refused on first questions too; refusal text keeps non-ASCII values maskable — security review finding), on `b603c1d6c` |
| Crewing | `feature/assistant-livedata-trial` (local): `a4024283` → results of this section committed after it; **no Crewing server code changed** |
| Pilot image / container | **`sail-assistant-py:crewtrial-812530d2c`** (43a01e35ccef), container `sail-assistant-py-crewtrial` :8062, `crewtrial.env` + `ASSISTANT_QUERY_STATE_GUARD=true`; stopped predecessors kept: `-r2` (97115789d), `-r3a`, `-r3b`, `-r3c` (b603c1d6c), `-r3d` (727602eb6) |
| Live | v10 :8053 untouched; nginx unchanged |

### 13.1 Pagination shown from the server's totals (item 1)

Every list-mode Crewing answer now ends with a line built by the assistant from the tool result's `total`, `returned`, `offset` and `nextOffset` — the model's text is not involved: *"Showing 5 of 8 matching crew members (records 1–5; 3 more available)."*, *"Showing 3 of 8 matching crew members (records 6–8; end of list)."*, *"Showing all 2 matching documents."*, *"Showing 0 matching documents."* Count and group answers get no line (their totals are the answer). Unit tests cover the four forms.

**PROVEN (R05, three runs on 727602eb6 and 812530d2c):** both lines appeared verbatim on every paged answer; the model's own "Showing 5 of 8" sentence, when present, is simply followed by the server line.

### 13.2 Accurate clarification when a filter is refused (item 2)

The refusal returned to the model now states the facts: *"`crewStatus = ["primary"]` was NOT part of the previous question; it would be a NEW condition that the user's message does not ask for. The previous question's filters are unchanged: … Tell the user exactly this … Never say that it was part of the previous question."* A changed value is described as *"would change from X (previous question) to Y"*. `keptFilters` excludes the refused condition. The Crewing rules tell the model the same.

**PROVEN live (R03.3, review run 1 on 727602eb6):** on "and regardless of rank?" the model added `crewStatus: primary` instead of removing the rank group; the guard refused and the answer read: *"The previous filters are kept: all vessels, on board, rank group engineers. 'Primary assignments' was not applied because you did not ask for it. Would you like the count with all ranks, keeping the other filters?"* — accurate (on the repeat the model removed the rank group correctly: 16 people).

**Also found and closed by the probe (V01):** on build 727602eb6 the model once added `crewStatus: primary` to a **first** question ("How many engineers are on board MV Beta Ocean?" → 3 instead of 4). The guard only checked follow-ups. From 812530d2c, "primary only" without the user's word (primary / secondary) is refused on first questions as well, with the same clarification; the probe then passed 2/2 twice (4 engineers, no `crewStatus` sent). Note: this closes the known narrowing case only; other inferred filters on first questions are not guarded (12.5).

### 13.3 Environment-routing tests (item 4)

`tests/test_env_routing.py` needs `httpx`, which the project lock does not include (the service uses `httpx2`); it was installed into the existing local venv (`uv pip install httpx`, lock and `pyproject` untouched). Result: **7 passed**. Whole suite afterwards: **127 passed** (119 before + pagination, wording, non-ASCII and first-question tests).

### 13.4 Targeted checks on the final build 812530d2c

| Check | Result |
|---|---|
| V01 clarification probe (2 turns) ×2 | 2/2, 2/2 — no `crewStatus` reached Crewing; "main contract" answered as data the assistant cannot access (honest) |
| R02 primary-only probe, R03 explicit removals, R05 paging (9 turns) | **9/9** (on 727602eb6: 8/9 and 9/9 — the miss was R03.3's refusal above, i.e. the ask instead of the answer) |
| C18 (drift case) + C09 (held-out) | **4/4** (on 727602eb6: 4/5 twice — C08.1 = the known alternative-route case) |
| Unit tests | 127 passed incl. env routing |
| Not re-run | masking T1–T8 and the full main set (no change to masking or history handling since §12; the only changes are the appended paging line, the refusal text and the first-question `crewStatus` rule) |

Tokens: unchanged order (≈ 8.8 k in / turn); the paging line adds nothing to the model's input. Cost: unverified.

### 13.5 Questionnaire and forwarding message (item 5, consolidated per the addition)

- `docs/output/CREWING-STAGE2-DOMAIN-QUESTIONNAIRE-FINAL.md` — one document, plain business language: **Part A "Needed now"** = the seven pilot decisions, each with today's provisional behaviour, an example, a recommendation and a tick-box choice, plus the request for two expected-result examples per trial area and the sentence that they are confirming rules, not listing questions; **Part B "For later development"** = crew status/availability, relief due, rest hours, rotation approvals, manning/vacancies, appraisal status — only the conflicting or unclear rules found in the code investigation (architecture proposal §1 and D2/D4/D5/D6), with an example, a recommended interpretation and a choice; where the code is consistent (crew status, rotation approvals) the proposed behaviour is stated for a tick. Part B is preparation only and authorises no development.
- `docs/output/CREWING-STAGE2-QUESTIONNAIRE-FORWARDING-MESSAGE.md` — the short message for Ghazi to forward (not sent by support).

### 13.6 Unchanged

User-typed name matching: pending as a separate decision. Release requirements: Datta's genuine login on dev, realistic-volume testing, the full Crewing suite base-vs-branch and the two-company gate. Trial resources stay up until told otherwise.

### 13.7 Documentation corrections and recordkeeping (28-Oct, late)

Astra's three corrections applied to the questionnaire and the forwarding message: (1) both introductions now say the live-data answers exist on the **isolated pilot only**; (2) B1 asks whether "available next month" includes people already available today (recommended: yes; example added); (3) B3's OPA wording was **wrong and is corrected**: the code shows the Rest Hours overview follows the per-record OPA checkbox (`opaMode` from the request; `opa_mode` stored per daily record, default off), while **both** rest-hours reports call the violation helpers with OPA hard-coded off (`restHours.ts:114-116`: `getViolationDates(…, "Rest", false, …)`, `calculateNCs(…, "Rest", false, …)`) — the earlier "one follows the checkbox" sentence had no basis. OPA 90 is explained in plain words (15 h work in 24 h; 36 h in 72 h, additive to the normal rules). "Without coming back" replaced by "to minimise further clarification".

Recordkeeping: the reviewed report, questionnaire and forwarding message are committed **locally** on `feature/crewing-livedata-trial` (worktree `TechnicalMoudle/.wt/crewing-trial`, `docs/output/`), next to the assistant code they describe; evidence files are in the Crewing trial branch `scripts/assistant-trial/results/` (round 3: `r3-context-1…6`, `-rescored`, `masking-checks-r3`, `r3-regression-*`; review: `review-paging-*`, `review-main-*`, `review-wording-*`, `final-paging`, `final-main`). No push or merge.
