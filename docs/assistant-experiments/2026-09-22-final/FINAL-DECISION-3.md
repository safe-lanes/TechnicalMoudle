# Stores bulk update — verified in the application, the pointer that escaped the repair, the fix, and the decision (third run)

22-Sep-2026, 14:38–15:07 UTC. **Nothing deployed, pushed or merged. Live (`sail-assistant-py-cand` :8017, `/health`
llmCalls 724 before and after), nginx, SMS RAG and every other service untouched. No LlamaParse upload (0).**
Supersedes `FINAL-DECISION-2.md` for the package below; the 30-source manifest, the R6 document, the five KB files,
the screenshot repairs, the model, prompt and serving flags are unchanged.

## 1. Verified application behaviour (PROVEN by reading the code; not from keywords)

Repository revision **`a30d14f83`** (branch `chatbot-enterprise`); `git diff origin/replit_dev` (**`f95b6e307`**, the
line Jeevan/Nilesh deploy) for every file below is **empty** — identical on both.

| step | evidence |
|---|---|
| Stores screen, button **"+ Bulk Update Stores / Lubes / Chemicals / Others"** (label follows the tab; the manual prints "+ Bulk Updates Store") | `client/src/pages/stores/Stores.tsx:2631-2637` — `onClick={openBulkUpdateModal}` |
| its handler **navigates inside Stores** | `Stores.tsx:982-983` — `openBulkUpdateModal = () => navigate(\`/stores/bulk-update?tab=${activeTab}\`)` |
| that route is Stores' own full-screen page | `client/src/App.tsx:80-81` — `/stores/bulk-update` → `BulkUpdateStores` |
| on the page: **Consume / Receive** selector; received date/place (apply to all rows); **Save Updates** → **Confirm & Save** | `BulkUpdateStores.tsx:716-717`, `:759-770`, `:964-971`, `:1005-1007` |
| it calls the **Stores** API | `BulkUpdateStores.tsx:164-172` — `POST /technical/api/stores/:vesselId/batch-consume` and `…/batch-receive` |
| server guard | `server/modules/stores/routes.ts:45,48` — `requirePMSAdmin` on both |
| Spares is a **different** page and route | `SparesNew.tsx:2641` → `/spares/bulk-update` (`App.tsx:76-77`), `BulkUpdateSpares.tsx:141` → `POST /technical/api/spares/bulk-update`, `server/modules/spares/routes.ts:25` |

**Conclusion:** Stores bulk update stays entirely within Stores. Nothing is shared with Spares at the UI, page or API
level; the user never navigates to Spares. The manual's "Refer to the 'Spares' sub-sub-module and follow the same
steps" (Office §1.1.8.3 p.50, Vessel §1.1.8.3 p.43) is a pointer to the *description* of the procedure (Spares
§1.1.7.8 p.47 / §1.1.7.6 p.40 — which themselves say only "click Spares; click 'Bulk Update Spares'"), not an
instruction to switch screens. **Code vs manual:** the manual describes nothing beyond the button; the
Consume/Receive/quantities/Save Updates/Confirm & Save sequence and the PMS-admin requirement exist only in the code and
are stated as code-derived guidance, never as manual text.

## 2. The stored `pmsvessel-3` answers, judged against that

Second-run (`kb-xref-d`) candidate answers: run 1 *"Use the same bulk-update steps as in the Spares sub-sub-module:
open Spares, then click Bulk Update Spares"*, run 2 the same, run 3 a separate "Spares — Office or Ship: open the Spares
sub-sub-module, click Bulk Update Spares" block inside the Stores answer. **All three are wrong** — a wrong-screen
instruction for a Stores task — regardless of the manual-coverage suite's mechanical verdicts (it passed runs 2 and 3
on phrase matching). They are stored as negative examples
(`routing-experiment/stores-bulk-negative-examples.json`) and the cross-reference judge's self-test now fails unless
all three score *incorrect*. The live answer parrots the manual ("refer to the 'Spares' sub-sub-module and follow the
same steps") and gives no procedure — not a wrong screen, but not an answer either.

## 3. Why the pointer escaped the earlier repair, and the narrow fix

`indexer/xrefs.py:is_pointer()` treats a section as a cross-reference **only when its body is nothing but the pointer**
(normalised length ≤ 220 chars). §1.1.8.3 has two steps of its own, the pointer, a caption and a note, so it was never
resolved: the raw sentence reached the model, and the model read "refer to Spares" as "go to Spares". The same
condition left 12 other pointer-carrying sections unresolved (listed in `s12/` build evidence).

**Fix (resolver `XREF_VERSION 2026-09-22.4`, `xrefs.py`):** `mixed_pointer()` — a section whose body contains a
sentence that both names a sub-module/tab/section in the manual's usual form (`XREF_RE`) **and** asserts "follow /
apply the same steps" (`SAME_STEPS_RE`) is resolved like a bare pointer, with one added line in the resolved block:
*"The steps of this section above are carried out on Stores. 'Refer to Spares and follow the same steps' means the
remaining procedure is the same as the Spares procedure — it does **not** mean opening the Spares sub-sub-module; stay
on Stores."* Pointers of other forms ("refer to the 'X' process", a bare quoted heading, names broken by bold or an
apostrophe) are deliberately **not** matched; they stay unresolved as before (10 sections).
`xref_facts.json` gains the code-verified `stores.bulk_update` fact with the file:line evidence of §1 (surfaced only for
sections whose title contains "bulk"). No business logic, prompt, model, flag or scoring rule was changed. Tests:
`tests/test_cleanup_xrefs.py` 20/20, including the new mixed-section test on a page shaped like §1.1.8.3 (resolved,
"stay on Stores" present, no "click Spares" in the adapted steps, "Bulk Update Spares" kept out of the page text).

**Rebuild:** new isolated index `kb-xref-e` (`build-kb-xref-e.sh`, image `sail-assistant-idx:r9g` = same Dockerfile
with the two changed files; `--cache-only --resolve-xrefs --apply-repairs --kb-dir kb-r6 --kb-provenance-line`,
`XREF_LAYOUT=quote-excluded`): 30 documents, 965 chunks, **0 LlamaParse uploads**, every parse from the store, every
manual vector reused. `manifest_check.py index` **PASSED** (30 files, 30 hashes, no extras, no forbidden revision).
Resolved cross-references 41 → **44** (+ Office §1.1.8.3, Vessel §1.1.8.3, Cert & Surveys §1.1.4.5 "add and view
attachments" for Surveys); source quotes 44/44 in metadata; chunk-level diff vs `kb-xref-d`: exactly those three
sections changed, nothing else. Scan of every adapted block for an instruction to open the source screen: **0**.
The one side-effect read in full: the Surveys attachments block adapts Certificates' steps correctly ("stay on Surveys")
but one step still says "for the selected certificate record" — a leftover noun, not a screen instruction; recorded, not
changed.

## 4. Regression run — the corrected package vs the isolated live copy (every suite, three-run rules)

CAND = **`sail-assistant-py-g6`** (127.0.0.1:8043): image `sail-assistant-py:v6-r9` (sha256 722127cab537…),
**index `kb-xref-e`**, prompt v5 `ff9ee87141ac1362`, gpt-5.6-luna default temperature, `ROUTE_INTENT=on`,
`HYBRID=rescue`, `CROSS_MODULE_GAP=0.25`/`SLOTS=2`, `ROUTE_MARGIN=0.07`; env diff vs `g5`: only `ASSISTANT_INDEX_SET`.
LIVE = `sail-assistant-py-livecopy` recreated with the same recipe as before (prompt-v2 image, `repaired`, gpt-4o-mini;
`/health` prompt sha = live's), removed by name afterwards. Same runner, same judges (base .9, work-order .13,
corrected-claims .4); cross-reference suite now **8 cases** (the Stores case added before any answer was generated),
run fresh on **both** arms (3 runs each). Inputs captured (LIVE 321, CAND 327 chat requests).

| suite (rule) | LIVE | CAND `kb-xref-e` | gains | losses (LIVE pass, CAND fail) | fail on both |
|---|---|---|---|---|---|
| routing 13 | 4 | **13** | 9 | none | none |
| retrieval 18 (v1; v2 identical) | 18 | **18** | — | — | — |
| work orders 8 (+5) — ALL 3 runs | 0 | **8** | 8 | none | none |
| frozen 12 — MAJORITY | 11 | 11 | 05 | **08** | none |
| corrected 14 — MAJORITY | 12 | **13** | 06, 13 | **01** | none |
| fresh 10 — ALL 3 | 9 | 9 | fresh-wo-broad-1 | **fresh-audit-1** | none |
| manual coverage 57 — ALL 3 | 36 | 31 | defects-1, moc-office-2, nm-3, sms-office-3 | **9** (below) | 17 |
| cross-reference 8 × 3 — correct / limited / incorrect | 6 / 3 / 15 | **21 / 3 / 0** | | | |

**The target case, `stores-bulk-update`, 3 / 3 correct on the candidate** (full answers in `s12/xref-answers-cand-e.json`):
*"Do not open the Spares sub-sub-module. 1. Open the Stores sub-sub-module. 2. Select the category … 3. Click
+ Bulk Updates Store / Bulk Update Stores. 4. On the Stores bulk-update page, select Consume or Receive. 5. Enter the
quantities for each location … 6. Click Save Updates, then Confirm & Save. … Both require the server-side PMS admin
permission; the manual does not specify a user role"* — with the source cited as §1.1.8.3 (p.43 / p.50) and the
cross-reference to §1.1.7.6 / §1.1.7.8 named as such, and the screen/permission details labelled code-derived. The
manual-coverage suite's `pmsvessel-3` reads the same on all three runs (its mechanical miss on run 1 is the literal
"same steps"). Provenance-misattribution flags: 0 of 24.

**One judge amendment, made after seeing these answers and pinned:** the three answers say *"Do **not** open the Spares
sub-sub-module"* / *"it is not necessary to open Spares"* / *"not performed in the Spares screen"* and the
cross-reference judge scored those prohibitions as instructions (its denial list lacked "do not open"). Added the
prohibition forms to `DENIAL`; the self-test pins all three sentences as must-discount, pins *"Open the **Spares**
sub-sub-module."* and *"open **Spares**, then click **Bulk Update Spares**"* as must-keep, and still requires the three
stored wrong answers to score *incorrect*. Before the amendment: 18 / 3 / 3; after: 21 / 3 / 0 — the difference is
exactly those three prohibitions, quoted above. The live arm is unaffected (6 / 3 / 15 either way).

### 4a. Every loss, read in full against the captured input

**Confirmed release-blocking defects: none.**

**Test defects requiring manual assessment — 12:**

| case | mechanical | what the candidate says | reading |
|---|---|---|---|
| frozen-08 (Waitlist export) | run 2 mentions "Crew Database" (must_not); run 3 "In Progress" without hyphen | 3/3 correct Waitlist steps (Waitlist → Edit → Export) citing §1.2.3.3 and §1.2.1.5; run 2 adds one aside: "the manual also supports exporting … from Crew Database (§1.3.1.4)" | correct procedure; the aside is true and off-question (not an instruction to use Crew Database for Waitlist) — flagged, verdict kept |
| corrected-01 (Job Code) | literal "generated" absent | 3/3 "No … optional; the system generates a code JOB-XXXXXXX; duplicate rule …" | the corrected R3 fact |
| fresh-audit-1 | run 3: literal "mandatory" absent | "Complete all inspection-record fields marked with *; Save; Upload; Next → Observation" | meets the owner's score_by |
| certsurveys-2 | "before the record can be saved" broken by inserted words, 3/3 | mandatory (*) fields must be completed before the new certificate (master) record can be saved | correct; excerpt carries it |
| crewing-2 (new) | runs 2–3: "release" ≠ "released" | "created and released through Admin before it becomes available in Promotion", plus the form-builder steps (Part A/Part B, Save Form) | correct; every added step is in the captured excerpt (Figure 57 note; §Document p.100) |
| crewing-3 | runs 2–3: wording of "active or ongoing onboard" | green/yellow/red as the manual | correct |
| crewing-4 | "check compliance" ≠ "check the compliance" | + Save and Propose | correct; both in the excerpt (verified this morning, same PDF) |
| fn-1 | run 2: "all pending actions" ≠ "all actions" | Submit only after Date Closed is updated and saved for every action | correct |
| moc-office-1 | run 3: "viewed, edited, or exported" | Office = view/edit/export; Vessel = attachments | correct |
| pmsvessel-2 | run 3: "unavailable" ≠ "not available" | No; the option is unavailable to Vessel Users; screen shown only to HOD | correct; both in the excerpt |
| pmsvessel-3 | run 1: "same steps" not literal | the corrected Stores procedure (above) | **correct — the case this task set out to fix** |
| ra-vessel-1 | runs 1, 3: "only view" ≠ "viewing purposes only" | view only, Eye icon | correct |

Manual coverage moved 34 → 31 against the second run with the live baseline unchanged at 36: crewing-2 is the one new
loss (above); pmsoffice-1, pmsoffice-2 and ra-office-3 passed on the candidate in the second run and fail on both arms
in this one — run-to-run variance of the kind measured on 18-Sep (18 of 261 paired runs disagree on identical
excerpts), not attributable to the resolver change (their sections are byte-identical between `kb-xref-d` and
`kb-xref-e`).

**Accepted limitations:** appraisals-filter stays *limited*; 17 manual-coverage cases fail on both arms (prep-3 and
sms-office-1 at retrieval level); 10 pointer sentences of other forms remain unresolved (listed in the build evidence)
— the model still receives them as the manual wrote them; the Surveys-attachments "certificate record" noun (§3).

## 5. Cost, tokens, latency (this run; both arms concurrent on one host)

| | LIVE (gpt-4o-mini, prompt v2) | CAND `kb-xref-e` (gpt-5.6-luna, prompt v5) |
|---|---|---|
| answers with a model call | 321 | 327 |
| input / output tokens per answer | ≈ 1,140 (estimate) / not recorded | **1,631 / 315** measured |
| latency mean / p50 / p95 | 2.2 s / 2.1 s / 3.3 s | **4.6 s / 3.9 s / 9.6 s** |
| cost per 1,000 answered questions | ≈ $0.32 (READ list price, output assumed) | **≈ $0.70** ($0.20 / $1.20 per 1M, READ) |

Unchanged from the second run within noise (1,622 / 313 tokens, 4.8 s then). The Stores fix adds one resolved chunk to
the affected sections only.

## 6. Decision: **PASS** — for exactly this package (verification only; deployment is the owner's decision)

`sail-assistant-py-g6` = image `sail-assistant-py:v6-r9` (sha256 722127cab537…) + index **`kb-xref-e`** (30 sources per
`manifest.json`, R6 + kb-r6, resolver 2026-09-22.4, quote-excluded, repairs 2026-09-14.1) + prompt v5 `ff9ee87141ac1362`
+ gpt-5.6-luna + the serving flags above. Against live it loses no case on substance; the Stores task the investigation
started from is now answered correctly on every run with the right screen, button, conditions and attribution; every
mechanical loss was read against the captured input and is a literal-phrase mismatch. Deployment and rollback are
exactly as in `FINAL-DECISION-2.md` §6 with **`ASSISTANT_INDEX_SET=kb-xref-e`** (`/health` must show `chunks 965`).
Not executed.

## 7. Evidence

`s12/` (runs.txt, every dump, `capture-livecopy.jsonl`, `capture-g6.jsonl`, `xref-answers-cand-e.json`,
`xref-answers-live.json`, `manuals-rejudge.txt`, `score.txt`, `read-losses.txt`, `build-kb-xref-e.log` on the server) ·
`index-kb-xref-e.txt` · `central-assistant-py/indexer/xrefs.py`, `xref_facts.json`, `tests/test_cleanup_xrefs.py` ·
`routing-experiment/xref_expectations.json` (8 cases), `judge_xref.py`, `stores-bulk-negative-examples.json`. Containers
left running: `sail-assistant-py-g6` (this package) and `-g5` (the previous one); `-livecopy` removed by name.
