# KB pilot — Technical module, work orders (15-Sep-2026)

Brief: `KB-PILOT-BRIEF.md` (owner). Scope kept: candidate instances only; live service, retrieval logic, prompt (v2), parser tier, thresholds and judges untouched. One change outside `kb/`: the assistant indexer gained a `--kb-dir` option to index reviewed markdown as-is with `source=kb-pilot` metadata (`central-assistant-py/indexer/index_documents.py`); it does not affect any existing index set.

## 1. Files produced (`kb/technical/work-orders/`)

| file | [manual:] | [screenshot:] | [code:] | [unverified] |
|---|---|---|---|---|
| planned-wo-ship-daily-scan.md | 6 | 0 | 7 | 0 |
| office-generate-now.md | 2 | 1 | 10 | 0 |
| office-generate-wo-per-job.md | 7 | 4 | 10 | 0 |
| unplanned-wo.md | 9 | 5 | 5 | 1 |
| CONFLICTS.md | 6 rows | | | |
| REVIEW.md | 4 rows, all "Converted" | | | |

**Screenshot content came from the PDF text layer, not from image reading.** No OCR engine exists on the build machine. The callout text on these pages is present in the PDFs' own text layer (text boxes drawn over the images), so every `[screenshot:]` callout quotation was extracted as text; the rendered page image was read only to place the 'Generate Work Order' pop-up option labels (p.18) and the unplanned form layout (p.29). **The image-only case — instructions that exist solely inside a PNG, as in frozen cases 01 and 05 — therefore remains untested by this pilot.**

## 1a. Pre-checks for the overview experiment (owner, 15-Sep, second brief)

*17 pilot chunks as indexed (`pilot-chunks.txt`):* each file is one heading, so each became one section cut at 1,200 characters into 4/5/4/4 pieces. The cut DOES separate conditions from the steps they govern: in office-generate-wo-per-job.md the whole "Prerequisites" block (vessel switch) is in chunk 0 and "Steps:" begins in chunk 1; in office-generate-now.md the role and switch are in chunk 0 and steps 2–3 are in chunk 1 (only step 1 is shared through the 150-character overlap). In planned-wo and unplanned-wo the conditions and the first steps sit together in chunk 0. Each file's Sources block also occupies 1–2 chunks of pure provenance text (chunks 2–4), which can rank as noise.
*Judge scope re-read (not edited):* wo-generic-01 and wo-generic-03 (three-paths: automatic generation stated; Generate Now block carries Sail Admin + switch; Generate WO block carries the switch and not Sail Admin) match the scope of a generic "how do I create a work order" question. **wo-generic-02 is over-scoped:** the question asks how planned work orders are created and whether the user must create them; the judge additionally requires the office 'Generate Now' conditions (Sail Admin + switch). A complete, correct answer for that question ("generated automatically by the ship's daily scan; you do not create them") fails that judge unless it also volunteers the office trigger. Flagged; left as is.
*Wording correction applied:* office-generate-wo-per-job.md and unplanned-wo.md now say "no role check on this path; normal authentication and vessel access still apply" instead of "any user".
*Overview file added:* how-work-orders-are-created.md (3 [manual:], 7 [code:], 0 [screenshot:], 0 [unverified]; REVIEW row Converted). Indexed as 3 chunks: chunk 0 = role + prerequisites + "Steps:" heading, chunk 1 = the three ways with their conditions, chunk 2 = exceptions / manual differs / sources. Pilot set `kb-pilot` now 931 chunks (911 + 20).

## 2. Guard trace — Generate Now vs per-job Generate WO (definitive)

- **Generate Now**: `client/src/pages/pms/WorkOrders.tsx:429` → `POST /work-orders/generate-now` (`server/modules/work-orders/routes.ts:91`) → `workOrderController.ts:131-148` calls `evaluateDirectGeneration(role, isShip)` → `workOrderGenerationGate.ts:114-161`: ship → allowed (`:120`); shore → role must be Sail Admin (`:44,141-147`) AND the vessel's office-generation switch must be on (`:71-87,150-161`). `evaluateDirectGeneration` has exactly one caller (`workOrderController.ts:133`).
- **Per-job Generate WO**: `client/src/pages/pms/Components.tsx:916` → `POST /jobs/:id/generate-wo` (`server/modules/jobs/routes.ts:40`, deliberately without a role guard — `:11` "LEFT OPEN") → `jobController.ts:153` (no role check) → `jobService.ts:570-587`: job must be active (`:570`); on shore only `isOfficeWoGenerationEnabled(vesselId)` (`:576-583`); then `jobDueScanner.generateWorkOrderForJob` (no gate).
- Result: **Generate Now = Sail Admin AND vessel switch. Per-job Generate WO = vessel switch only, no role.** Code at `origin/replit_dev` cf5241ad6 (seven files byte-identical to the working branch). The running Technical revision (dev/prod deployment, Replit phase2 fork) is NOT verified as identical.

## 3. Conflict log summary (`CONFLICTS.md`)

Six rows: (1) per-job 'Generate WO' shown unconditional in both June manuals, code requires the vessel switch on the office side; (2) automatic ship generation absent from the manuals; (3) office 'Generate Now', the Sail Admin restriction and the switch absent from the manuals; (4) Generate Now button shown to Client Admin / Head of Dept while the server allows Sail Admin only (link to the existing standalone note, not re-investigated); (5) Office manual has a 'select vessel' step the Vessel manual lacks (manual-vs-manual, not code); (6) the earlier single code-derived section (R3.2 §1.1.14.13) superseded on the candidate by these files.

## 4. Runs A, B, C

Configuration for all three: image `sail-assistant-py:prompt-v2` (live), prompt `v2-xref-hardrule-2026-09-14` (live hashes), thresholds and judges unchanged. A = index `kb-base` (911 chunks, chunk ids identical to live `repaired` 911/911; the R3.2 single section is NOT present — the Recent Updates document is the live R3.1 revision d10f3027834959ef). B = `kb-pilot` = A + 17 pilot chunks (4 files → 4/4/5/4 chunks of ≤1200 chars), excerpts 5. C = B with `ANSWER_CHUNKS=6`. Raw outputs: `kb-runs.txt`, `kb-rank.txt`, `kb-*-dump.jsonl`.

| suite | A (kb-base) | B (kb-pilot, 5) | C (kb-pilot, 6) |
|---|---|---|---|
| retrieval 18 queries, expectations v1 / v2 | 18/18 · 18/18 | 18/18 · 18/18 | 18/18 · 18/18 |
| frozen 12-case (.3), 3-run | 11/12 (05) | 11/12 (05), no regression | 11/12 (05) |
| corrected claims (.2), 3-run | 12/14 (04, 13) | 13/14 (04) | 13/14 (04) |
| wo-generic-01 "How do I create a work order?" (.3, all runs) | 0/3 | 0/3 | 0/3 |
| wo-generic-02 "How are planned work orders created…" | 0/3 | 0/3 | 0/3 |
| wo-generic-03 "How to create work order in PMS?" | 0/3 | 0/3 | 0/3 |

Per work-order question — which chunk ranked where (`kb-rank.txt`), and whether a pilot chunk was in the excerpts:

- **wo-generic-01** "How do I create a work order?": A top-5 = Office p.29 unplanned, Vessel p.24 unplanned, Office p.32 complete, Vessel p.27 complete, Office p.28 intro. B/C top-8 = **pilot unplanned chunk 0 (rank 1, 0.7891)**, Office p.29, Vessel p.24, **pilot unplanned chunk 1 (rank 4)**, Office p.32, Vessel p.27, Office p.28, Vessel p.23. The pilot planned, Generate Now and Generate WO files are **not in the top 8**. Answer in B and C (3/3 runs): the unplanned procedure only, citing the pilot file and the manuals. Fails on "automatic generation missing; Generate Now / Generate WO not described". Pilot chunk in excerpts: YES (the unplanned one only).
- **wo-generic-02** planned question: A top-5 = unplanned ×2, pre-plan ×2, intro. B top-5 = unplanned ×2, Vessel pre-plan, **pilot planned chunk 0 (rank 4, 0.8409)**, Office pre-plan; C adds pilot planned chunk 2 (rank 6). Answer in B and C (3/3): "Planned work orders are generated automatically by the ship's daily job-due scan… no user action… every 24 hours" — correct and cited to the pilot file. Fails only the judge's requirement that the office 'Generate Now' conditions (Sail Admin + switch) appear: that content is in a different pilot file (office-generate-now.md), which was not in the top 8 for this question. Pilot chunk in excerpts: YES.
- **wo-generic-03** "How to create work order in PMS?": no pilot chunk in the top 8 in B or C (A = B ranking: Office intro p.28, unplanned p.29, complete p.32, Vessel unplanned p.24, Vessel intro p.23; C adds Office pre-plan p.30). Answer: unplanned only. Pilot chunk in excerpts: NO. Excerpt count 6 did not change the outcome.
- **case 09** (frozen, "How do I create a COC defect record?"): no pilot chunk in the top 8; passes 3/3 on A, B and C. Meaning-based reading of the B answers (all three runs): the borrowed Defect Log steps are connected to the requested COC workflow — "To create a COC defect record… These steps are the same as section 1.1.4.3 …". Frozen judge: ✓ 3/3. Meaning judge: ✓ 3/3. Same on A and C. Since prompt v2 + this index passes and yesterday's prompt v3 + index dropped the sentence in 2/3 runs (run H), the case-09 drop is attributable to the prompt change, not the index.

## 5. Failures in B with a pilot chunk in the excerpts → retrieval/answer issue, not content

- wo-generic-01: the pilot unplanned chunk was shown (rank 1) and answered correctly for its own procedure; the failure is that the other three procedures were never retrieved (ranks > 8). With four separate files, nearest-neighbour retrieval on the generic phrasing returns only the file whose heading matches ("Create an unplanned work order"). Retrieval issue.
- wo-generic-02: the pilot planned chunk was shown and the answer is correct for it; the judge's Generate Now condition lives in another file that was not retrieved. Retrieval issue (and a judge that spans two procedures).
- wo-generic-03: no pilot chunk shown — retrieval issue; excerpt count 6 does not reach any pilot chunk.

**Pilot verdict on the brief's claim:** with retrieval, prompt and excerpt count exactly as live, rewriting the work-order content as four procedure-level files did NOT make the failing generic cases pass (0/3 → 0/3 on all three). It did make the explicit planned-work-order question answerable and correctly cited (content retrieved at rank 4), and it left every existing passing case intact (frozen 11/12, retrieval 18/18). The single-section form (R3.2, one heading matching the generic phrasing, all three ways in one chunk) reached rank 1 for the generic question yesterday; the four-file form does not, because the generic phrasing is closest to the unplanned procedure's heading. The content is in the index; the ranking does not surface it for generic phrasings.

## 7. Overview experiment (run D2, 15-Sep; `kb2-runs.txt`, `kb2-rank.txt`, `kb2-*-dump.jsonl`)

Configuration: A = `kb-base` (911, = live), B = `kb-pilot` (931 = 911 + 4 procedures 17 chunks + overview 3 chunks); image and prompt v2 as live; excerpts 5; thresholds and judges unchanged; 3 runs, all runs required for the work-order cases.

Existing suites on B: retrieval 18/18 (v1 and v2), frozen 11/12 (no regression), corrected 13/14 — identical to A.

| question | overview rank (top-8 probe) | in the 5 excerpts? | A | B (runs passing) | what the B answers did | classification |
|---|---|---|---|---|---|---|
| wo-generic-01 "How do I create a work order?" | 8 | no | 0/3 | 0/3 | unplanned only (manual p.29 + pilot unplanned chunks ranks 2/4) | **retrieval** — the unplanned procedure and the manual's unplanned section are nearer than the overview |
| wo-generic-02 "How are planned work orders created… myself?" | 6 | no (pilot planned chunk at rank 4 is) | 0/3 | 0/3 | "generated automatically by the ship's daily job-due scan; you do not have to create them" (3/3, correct, cited to the pilot file) | fails only the **over-scoped judge** (§1a); the office trigger is in files ranked 6+ |
| wo-generic-03 "How to create work order in PMS?" | not in top 8 | no | 0/3 | 0/3 | unplanned only | **retrieval** |
| wo-phr-01 "What are the different ways to create a work order in PMS?" | 1, 2, 3 | yes | 0/3 | 2/3 | runs 1–2: all three ways with every condition (Sail Admin + switch on Generate Now; switch, no role, duplicate rule on Generate WO; no switch on unplanned); run 3 omits the office 'Generate Now' sentence entirely | **answer generation** — overview shown, one run drops the office condition |
| wo-phr-02 "I need to raise a work order for a pump — how?" | not in top 8 | no | 0/3 | 0/3 | unplanned procedure (pilot file ranks 1–2) — a reasonable answer for this phrasing; the three-paths judge demands all three ways | **retrieval** for the judge's scope; the judge's scope for this phrasing is debatable |
| wo-phr-03 "Do I create work orders myself or does the system create them?" | 1, 2, 3 | yes | 0/3 | 0/3 by judge · 2/3 by reading | all runs state the three ways; runs 1–2 carry every condition; run 3 omits the per-job vessel switch. All three fail the judge only because it says "created automatically by the ship system" and the judge's phrase list expects "generated automatically" — **judge phrase defect, flagged, not edited** | answer generation (run 3) + judge phrase |
| wo-phr-04 "Steps to create a new work order" | 8 | no | 0/3 | 0/3 | unplanned only | **retrieval** |
| wo-phr-05 "How do work orders get created in the Technical module?" | 1, 2, 3 | yes | 0/3 | 1/3 | run 2 complete with all conditions; runs 1 and 3 keep the ship rule and the per-job/unplanned conditions but omit the office 'Generate Now' sentence | **answer generation** — overview shown, condition dropped in 2 of 3 runs |

**Which issue it is:** both, cleanly separated. (1) **Retrieval**: for imperative phrasings ("how do I create", "how to create", "steps to create", "raise a work order") the overview is at rank 8 or below; the unplanned procedure and the manual's unplanned section are nearer, so the model never sees the other ways. Content is present; ranking does not surface it. (2) **Answer generation**: when the overview IS in the excerpts (three phrasings), the model states all three ways but drops the office 'Generate Now' condition in 3 of 9 runs and the per-job switch in 1 of 9 — with the overview's own text stating them explicitly. The conditions rule tested yesterday (prompt v3) targeted exactly this, and regressed case 09; no prompt change was made here.

Not changed: prompt, thresholds, excerpt count, judges, the four procedure files (except the owner-ordered role wording), live.

## 6. Guesses (not findings)

- None of the results above are inferred; all come from the runs. One `[unverified]` remained in unplanned-wo.md at the time of §7 (whether the running-hours completion check applies to the unplanned form's Part B submission) — not traced; moved out of the indexed text into REVIEW.md in the third step (§8.1).
- Interpretation, not measured: an overview/index procedure ("ways to create a work order") or a retrieval change (duplicate Office/Vessel collapse, or grouping chunks by procedure) would be the next candidates for the generic phrasing. Not tested, not proposed as fact.

## 8. Third bounded step — content fixes, one chunk per file, judge .4, run D3 (15-Sep; `kb3-*`)

Live unchanged. Prompt v2, retrieval logic, thresholds and excerpt count (5) exactly as live. Correction (15-Sep, after external review): the docs path (`chat.py:110` → `retrieval.docs_prompt`) sends each chunk's FULL text with a `[i] (manual — section)` header and `---` separators; the 3,000-character cut applies only to the tool path (`search_docs_tool`). The probe below reproduced `text[:3000]` without the headers — identical text for every chunk involved (all ≤ 2,105 characters), but it is a reconstruction, not a capture of the wire body. Instances: A = 8016 `kb-base` (911 chunks = live ids), B = 8018 `kb-pilot` (916 = 911 + 5). Artefacts in this folder: `kb3-runs.txt` (all suites), `kb3-rank.txt` (top-8 probe + chunk listing), `kb3-rejudge.txt` (judge .3 vs .4 on the stored D2 answers), `kb3-excerpts.json` (exact excerpt text per question × set), `kb3-failures.md` (every failing run with the excerpt text attached), `kb3-general5.txt/json`, the three `kb3-*-dump.jsonl`, and the two capture scripts `probe_kb3.py` / `failures_kb3.py` (evidence capture, kept for reproducibility; not suites).

### 8.1 Content fixes (step 1) — `kb/technical/work-orders/`

| file | change |
|---|---|
| how-work-orders-are-created.md | steps 2 and 3: "Any role" → "No role check on this path (sign-in and vessel access still apply)"; "select the vessel" marked "(Office: select the vessel)" in both steps; step 2 now states the two job conditions (job active; no active work order already) |
| office-generate-wo-per-job.md | ship path: "no switch and no role check; the two job conditions below still apply"; "On both instances the job must be active / must not already have an active work order"; step 1 "(Office: select the vessel first)" |
| planned-wo-ship-daily-scan.md | exception rewritten: office-side generation is done in one of two ways — 'Generate Now' (Sail Admin AND switch) or per-job 'Generate WO' (switch) — Generate Now is not the only office-side way |
| CONFLICTS.md row 3 | same correction (two office ways), code refs extended with `jobService.ts:576-583` |
| unplanned-wo.md | the `[unverified]` running-hours sentence removed from the indexed text; Exceptions now "None recorded in this pilot" |
| REVIEW.md | the running-hours question logged as an open item for the reviewer; overview row present; note that no `[unverified]` tag remains in any indexed file |

Contradiction re-read of all five files: none left. A grep for the retired wordings ("any role", "same gate", "the only", Sail Admin attached to Generate WO) returns only correct statements (Sail Admin belongs to 'Generate Now' only; the per-job path has no role check).

### 8.2 One chunk per kb file (step 2)

Indexer one-chunk mode for `--kb-dir`: the `Sources:` block and every inline `[manual:|screenshot:|code:|unverified]` tag are removed from the embedded text and stored in chunk metadata (`kb_sources`, `kb_provenance`, `kb_one_chunk`); the body is embedded as ONE chunk. `kb-pilot` re-indexed: 916 chunks (911 live + 5). Embedded sizes vs the excerpt budget (3,000 characters per excerpt):

| kb file (display name) | embedded chars | tags → metadata | Sources block chars → metadata | fits one excerpt whole? |
|---|---|---|---|---|
| How work orders are created — the three ways to create a work order | 2,044 | 10 | 596 | yes |
| Office 'Generate Now' — generate a vessel's due work orders from the office | 1,899 | 13 | 925 | yes |
| 'Generate WO' for one job — from the Components page | 2,105 | 21 | 1,305 | yes |
| Planned work orders — generated automatically by the ship's daily job-due scan | 1,952 | 13 | 780 | yes |
| Create an unplanned work order ('+ Unplanned W.O') | 1,572 | 18 | 970 | yes |

The exact chunk texts as supplied to the model are in `kb3-failures.md` (overview, planned, unplanned) and `kb3-excerpts.json` (all). Conditions and steps of one procedure are now always in the same excerpt.

### 8.3 Judge .4, versioned (step 3) — old vs new on the SAME stored answers

`acceptance_wo.py` WO_SUITE_VERSION `2026-09-14.4`, `JUDGE_VERSION` 3|4 selectable; `rejudge_wo.py` re-scores a stored dump with both. Changes: (a) "created automatically" / "automatically creat…" accepted as automatic generation; (b) wo-generic-02 re-scoped to the question asked — automatic generation + "you do not create them"; the Generate Now pairing is checked only if the answer describes Generate Now; (c) wo-phr-02 expects the unplanned procedure (`unplanned w.o` + Part B / Submit) plus a one-line note of the other ways. Re-scoring the D2 answers (`kb3-rejudge.txt`): **only wo-generic-02 B changes, 0/3 → 3/3**; all other 15 rows keep their score. wo-phr-03 B stays 0/3 under .4 — its content rule now passes on every run ("automatic generation ✓; pairing ✓"), but the case's literal must-phrases (`unplanned w.o`, `generate wo`) are absent from those answers ("unplanned work orders", "per-job"). That literal check is part of the base judge shared with the frozen suite; not changed.

### 8.4 Run D3 — A vs B, 3 runs, all suites + 8 work-order phrasings (step 4)

| suite | A kb-base | B kb-pilot |
|---|---|---|
| retrieval 18 (expectations v1 / v2) | 18/18 · 18/18 | 18/18 · 18/18 |
| frozen 12 (.3), joint of 3 runs | 11/12 | 11/12 |
| corrected 14 (.2) | 13/14 | 13/14 |
| work-order 8 (.4), all runs required | 0/8 | **1/8** (wo-generic-02 3/3) |

Existing suites: identical A vs B, no regression. Overview rank in the top-8 probe after one-chunk indexing (D2 multi-chunk rank in brackets):

| question | overview rank | other pilot chunk in top 8 | in the 5 excerpts? |
|---|---|---|---|
| wo-generic-01 How do I create a work order? | 3 (was 8) | unplanned kb 8 | **yes** |
| wo-generic-02 How are planned work orders created… myself? | 5 (was 6) | planned kb 7 | yes |
| wo-generic-03 How to create work order in PMS? | not in top 8 (same) | none | no |
| wo-phr-01 different ways | 1 (was 1) | — | yes |
| wo-phr-02 raise a work order for a pump | 8 (was out) | unplanned kb 4 | no (unplanned kb yes) |
| wo-phr-03 myself or the system | 1 (was 1) | planned kb 3 | yes |
| wo-phr-04 Steps to create a new work order | 4 (was 8) | unplanned kb 6 | **yes** |
| wo-phr-05 how do work orders get created | 1 (was 1) | — | yes |

**Every failing run, classified against the exact excerpt text it was given** (`kb3-failures.md`; owner rule: answer generation only if the condition was in that text and the answer dropped it). Cross-check: the citations returned by all 45 failing runs lie within the probe's hit list for that question — 0 mismatches. Correction (15-Sep, after external review): this shows the probe and the runs retrieved the same chunks; it does NOT capture the final messages sent to the model (headers, order, separators). The service has a wire-capture seam (`ASSISTANT_CAPTURE_OUTBOUND`, `app/llm.py:32-43`, body only, no headers or keys) that can record the actual request bodies on the candidate; not used in D3. Until that capture exists, "the text was in front of the model" is INFERRED from identical retrieval, not PROVEN.

| case | B runs | what the 5 excerpts contained | what the answer did | classification |
|---|---|---|---|---|
| wo-generic-01 | 0/3 | overview at rank 3 (all three ways, every condition) behind the two manual unplanned sections | unplanned procedure only, 3/3 | **answer generation** (D2: retrieval — the overview was not in the excerpts then) |
| wo-phr-04 | 0/3 | overview at rank 4 | unplanned procedure only, 3/3 | **answer generation** (D2: retrieval) |
| wo-phr-01 | 0/3 | overview at rank 1 | all three ways; Generate Now with Sail Admin + switch; the per-job 'Generate WO' block carries "no role check" and the two job conditions but drops "in the office only if the vessel switch is on" in 3/3 (run 3 drops all per-job conditions). The overview states the switch twice (Prerequisites line and step 2) | **answer generation** (D2: 2/3 passed) |
| wo-phr-05 | 0/3 | overview at rank 1, manual p.18 'Generate WO' at rank 4 | same drop of the per-job switch, 3/3 | **answer generation** (D2: 1/3 passed) |
| wo-phr-03 | 0/3 | overview rank 1 + planned kb chunk rank 3 (both state Generate Now = Sail Admin + switch) | planned "created automatically by the ship system" ✓; per-job described by meaning ("in the office if the vessel's switch is on") without the button name; office 'Generate Now' / Sail Admin absent in 3/3 | **answer generation** (Generate Now dropped) + literal must-phrase (§8.3) |
| wo-generic-03 | 0/3 | no pilot chunk (overview outside top 8) | unplanned only | **retrieval** |
| wo-phr-02 | 0/3 | manual unplanned ×2, unplanned kb chunk (rank 4), completion ×2 — none states the other ways (the kb chunk's "Related procedures" line lists file names only) | unplanned procedure ✓ 3/3; no note of the other ways | **retrieval** for the note (the content the judge wants is not in any excerpt) |
| A (all 7 failing cases) | 0/3 each | manual sections only — no automatic generation, no Generate Now anywhere in the live corpus; p.18 'Generate WO' present for phr-03/05 | unplanned only, or "not covered" | retrieval / corpus (content absent) |

Totals for B: 21 failing runs = 15 answer generation (5 questions × 3) + 6 retrieval (2 questions × 3). Totals for A: 24 failing runs, all content-absent.

**What changed between D2 and D3, honestly:** one-chunk indexing moved the overview into the excerpts for two more phrasings (wo-generic-01, wo-phr-04) — and the model still answered "unplanned only" there. The balance therefore moved from retrieval to answer generation: 5 of the 7 failing B questions now fail with the needed text in front of the model. Two remain retrieval (wo-generic-03, wo-phr-02). wo-phr-01 and wo-phr-05 got **worse** on the measured metric (2/3 → 0/3, 1/3 → 0/3): the per-job vessel switch is now dropped in 6/6 runs where it survived 8/9 in D2. Two things changed for those runs at once — the step-2 wording (D2: "Any role; in the office only if the vessel switch is on; refused if…" → D3: "No role check on this path (sign-in and vessel access still apply); in the office only if the vessel switch is on; the job must be active and…") and the excerpt composition (D2: three overview chunks at ranks 1–3; D3: one overview chunk plus manual sections). Which of the two causes the drop is NOT separated by this run (INFERRED either way); a content-ordering change (switch clause first) would test the first cause. Not done — reporting first.

### 8.5 Five general Technical questions (step 5) — pilot chunks do not interfere

One run each on A and B (`kb3-general5.txt`, ranks in `kb3-rank.txt`). No pilot chunk appears in the top 8 for any of the five on B. Top-2 citations identical A vs B for all five; answers give the same steps and source. Wording differs slightly in 2 of 5 (defect: closing sentence; running hours: steps 2–3 merged) — single runs, ordinary run-to-run variation, not attributable to the set.

| question | rank-1 hit (both sets) | answer (both sets) |
|---|---|---|
| How do I record a stock transaction for spares? | Vessel manual 1.1.7.2 Spare inventory transactions (p.38) | Spares → Location icon → choose location / + Create New Location → Save |
| How do I add a new store item? | Vessel manual 1.1.8.4 How to add item (p.43) | Store → + Add Store → details → Save Store Item |
| How do I raise a defect on equipment? | Defects Office manual 1.1.4.3 Create a new defect (p.15) | + New Defect → Parts A/B/C → Submit |
| How do I update running hours for a component? | Vessel manual p.34 / 1.1.6.3 (p.33) | Gear icon → enter details → Save |
| How do I add a component to a vessel? | Office manual 1.1.4.3 How to add components (p.24) | select vessel → Add Component → details → Save → Submit |

### 8.7 External review of §8 (Astra, 15-Sep) — checked point by point

1. *"The attachments are D2, not D3."* Handover issue: the reviewer received `kb2-*`. The D3 evidence is `kb3-runs.txt`, `kb3-rank.txt`, `kb3-rejudge.txt`, `kb3-failures.md`, `kb3-excerpts.json`, `kb3-*-dump.jsonl` (all in this folder, commit fc3c0b1cc).
2. *"The judge rejects correct wording and accepts missing conditions."* (a) "created automatically" rejected — true under .3, fixed in .4 (§8.3). (b) **Confirmed defect in .3 AND .4:** when the model writes "1. … 2. … 3. …" inside one paragraph (no line breaks), `blocks_of` returns ONE block, so the per-action check reads the whole answer as the Generate WO block and the Generate Now sentence's "switch" satisfies it. D2 wo-phr-03 B run 3 omits the per-job switch ("any user can generate a work order on demand, provided the job does not already have an active work order") and both judge versions report "pairing ✓". The pairing therefore only works when the answer uses line-separated numbered/bold items (as the D3 wo-phr-01/05 answers do). Fix candidate: split blocks on inline "N." numbering as well; version as .5; validate on the 96 stored D2 + D3 answers before any new model call. Not done.
3. *"Matching citations does not prove the model input."* Accepted; §8 corrected above. The capture seam exists and needs no code change (env var on the candidate container, body only).
4. *"1/8 does not mean seven answers are factually wrong."* Accepted. The 21 failing B runs of D3, split by kind (from reading every answer against the manual p.29 text and the overview):

| kind | runs | cases |
|---|---|---|
| unsupported or incorrect instruction | **0** | — (every step stated matches manual p.29 / p.18 or the overview) |
| missing prerequisite for an action the answer describes | 6 | wo-phr-01 ×3, wo-phr-05 ×3 (per-job Generate WO without the office switch) |
| missing alternative the question asks for | 12 | wo-generic-01 ×3, wo-generic-03 ×3, wo-phr-04 ×3 (generic question, unplanned only); wo-phr-03 ×3 (office Generate Now / Sail Admin absent) |
| judge-only / owner-set expectation | 3 (+3 partial) | wo-phr-02 ×3 (the "other ways" note is the owner's .4 design choice; the unplanned procedure itself is complete and correct); wo-phr-03 additionally fails the literal must-phrase |

Reviewer's proposed diagnostic (give the failing generic question ONLY the overview, unchanged prompt): feasible inside the prompt-v2 container by calling `retrieval.docs_prompt` with a one-hit `Routed` — must run in that container, because `app/retrieval.py` on the branch carries the v3 conditions rule text (lines 131-133), not v2. Not run; awaiting the owner.

## 9. Judge .5 + captured model inputs + overview-only diagnostic (owner GO, 15-Sep; `judge5-validation.txt`, `diag-*`)

Live unchanged. No content, retrieval or prompt change. Nothing deployed.

### 9.1 Judge .5 — attribution rebuilt, validated on the 96 stored answers first

`acceptance_wo.py` WO_SUITE_VERSION `2026-09-14.5`, `JUDGE_VERSION` 3|4|5 selectable; frozen suites and the shared base judge untouched. .5 segments the answer body into units (line breaks; "N." enumerators at line start or inline, section numbers like 1.1.5.2 excluded; "- " bullets; sentence ends) and builds action scopes: a unit naming an action opens that action's scope, units naming no action stay with the open scope (sub-bullet conditions stay with their action), a unit naming another action closes it. Conditions are checked inside the scope of their own action. Segmentation is the mechanism, not the proof: every scope the judge attributed was printed and read (`judge5-validation.txt`, `--scopes`).

Format survey of the 96 answers (D2 + D3): 87 numbered items on separate lines, 9 plain paragraphs, 0 with headings only — under .3/.4, 78 of the 96 were ONE block, so any condition anywhere in the answer satisfied any action.

Validation on the same stored answers (`rejudge_wo.py`, versions 3/4/5 side by side):

| what changed .4 → .5 | count | detail |
|---|---|---|
| rule-level outcome | 1 | D2 wo-phr-03 B run 3: .4 "pairing ✓" → .5 "pairing ✗: Generate WO block lacks the vessel switch" — the known false positive; the per-job sentence reads "any user can generate a work order on demand, provided the job does not already have an active work order" (no switch) |
| overall PASS/fail per run | 0 | that run already failed the literal must-phrase, so no case score moves; all 16 case rows keep their .4 score |
| known false negatives re-checked | 0 changed | D3 wo-phr-01/05 B (6 runs) still fail — by reading, their per-job scope has no switch; D2 wo-phr-01 runs 1–2 and wo-phr-05 run 2 still pass — their per-job scope states the switch |

Manual scope check: all 18 B answers that name Generate Now or Generate WO were read against their .5 scopes; every condition is attributed to the action it was written for. Artefact (harmless, reported): the next item's heading ("2. **one job on demand**:") trails into the previous scope because a heading names no action. Limitation: a condition written BEFORE the first action unit belongs to no scope; none of the 96 answers does this.

### 9.2 Environment record (PROVEN from the container and the captured wire bodies)

| item | value |
|---|---|
| container / image | `sail-assistant-py-exp2` (port 8018), image `sha256:8db669090d36…` = `sail-assistant-py:prompt-v2`, started 2026-09-15T04:45:57Z |
| prompt | `v2-xref-hardrule-2026-09-14` · docsPromptSha `b37172f6122a0257` · toolLoopPromptSha `f8e5a8f86bede638` · combined `ebfd83a623e41173` (from `/health`); **every one of the 12 captured chat bodies carries a system message whose sha256[:16] = `b37172f6122a0257`** — the served v2 text, not the branch's v3 text |
| model settings | `gpt-4o-mini`, temperature 0.2, timeout 30 s (in every captured body) |
| retrieval settings | answer_chunks 5 · route_top_k 10 · sim floor 1.15 · margin 0.07 · masking on |
| index | `kb-pilot`, 916 chunks (911 without `source` + 5 `kb-pilot`); overview chunk 2,044 chars, metadata carries `kb_sha256`, `chunker_version`, `embed_model`, `embed_sha` (no build table exists in this schema — `assistant_index_builds` absent) |
| identity / masking | acceptance test identity (`diag-N`, "Acceptance", Sail Admin, `smoke-suite-tenant`), masking path on; capture scanned: 0 keys, 0 bearer tokens, 0 identity names |
| capture | `ASSISTANT_CAPTURE_OUTBOUND` set on the diagnostic **process only** (docker exec env), never on the running service; 18 wire bodies (6 embeddings + 12 chat); file copied out, deleted from the container and from the server's /tmp; nothing to disable afterwards |

Arm NORMAL = `app.chat.handle_chat(...)` in-process — the served path (rate limit, pair, redirect, embed → retrieve → route → `docs_prompt` → `agent.answer_docs`) minus the HTTP layer; decision surfaced here, taken so the running service needed no restart to capture. Arm OVERVIEW = the same docs path with `routed` replaced by one hit, the complete overview chunk, fetched from the same index set. Everything else identical. Captured user messages: NORMAL 6,417 / 5,095 chars with 5 `[i] (manual — section)` excerpts; OVERVIEW 2,272 / 2,301 chars with 1.

### 9.3 Results — 2 questions × 2 arms × 3 runs (`diag-analysis.txt` has every full input and answer; `diag-capture.jsonl` the wire bodies)

| question | arm | excerpts in the captured message | alternatives covered | Generate Now with Sail Admin + switch | per-job Generate WO with the office switch | judge .5 |
|---|---|---|---|---|---|---|
| How do I create a work order? | NORMAL | manual unplanned ×2 (ranks 1–2), **overview (rank 3)**, manual completion ×2 | 0/3 — unplanned only | not described 3/3 | not described 3/3 | 0/3 |
| How do I create a work order? | OVERVIEW only | overview | **3/3** | 3/3 | 2/3 (run 2 drops it) | 1/3 (runs 2–3 also fail a judge synonym, see 9.4) |
| What are the different ways…? | NORMAL | **overview (rank 1)**, manual intro ×2, manual unplanned ×2 | 3/3 | 3/3 | **0/3** — "No role check applies; the job must be active and must not already have an active work order" (the middle clause "in the office only if the vessel switch is on" dropped every time) | 0/3 |
| What are the different ways…? | OVERVIEW only | overview | 3/3 | 3/3 | **3/3** | **3/3** |

### 9.4 Split by kind (owner rule: missing prerequisites are substantive answer defects)

| kind | NORMAL (6 runs) | OVERVIEW only (6 runs) |
|---|---|---|
| unsupported or incorrect instruction | 0 | 0 (every step matches the overview text) |
| **missing prerequisite for an action described** | 3 (phr-01: per-job switch, 3/3) | 1 (generic-01 run 2: per-job switch) |
| missing alternative the question asks for | 3 (generic-01: planned + per-job absent, 3/3) | 0 |
| environment qualifier weakened (condition kept, "office only" dropped or everything framed office-side) — not counted by the judge | 0 | 4 (generic-01 runs 1, 3: "The vessel's switch must be ON for this option" without "office only"; phr-01 run 1 same; phr-01 run 3 frames per-job and unplanned as "In the office, …") — reported as a substantive precision defect, distinct from a missing prerequisite |
| judge-only | 0 | 2 (generic-01 runs 2–3: "The system generates them/these automatically" is not in the automatic-generation phrase list of .4/.5 — a synonym gap found after validation; not edited) |

### 9.5 What the diagnostic decides

With the overview ALONE and the unchanged v2 prompt, the model covers all three ways 6/6 — improved coverage — but does NOT consistently preserve prerequisites and Office/Ship applicability: under judge .6 only 3 of those 6 runs pass (per-job switch dropped once; stated without the office qualifier three times, see §10.1); overview-only is therefore not a complete success (owner correction, 15-Sep). With the normal five excerpts — where the overview IS in the captured message (rank 3 and rank 1) — it drops the alternatives 3/3 for the generic question and the per-job switch 3/3 for the "different ways" question. Per the reviewer's decision tree: the conditions largely survive when the overview is alone, so the dominant cause is the **competing manual excerpts**, not the prompt or the content. Two observations narrow it further (INFERRED, one diagnostic): for the generic question the manual's unplanned sections sit at ranks 1–2 above the overview and the answer copies them; for "different ways" the overview is rank 1 and the alternatives survive but the one clause that the manual never states (the office switch) is the one dropped. A residual answer-construction effect remains (1/6 switch drop and 4/6 weakened environment qualifiers with the overview alone).

**Smallest next fix to test (not implemented):** on the candidate only, collapse the duplicated Office/Vessel manual sections in the five excerpts — the same section from the two manuals occupies two of the five slots for both questions (ranks 1–2 for the generic question, 3–4 for "different ways") — so the overview and its conditions compete with less near-duplicate text. It changes which of the already-retrieved chunks are shown, nothing else; measured with the frozen suites (must stay 18/18 · 11/12 · 13/14) and the work-order suite under judge .5, three runs, with wire capture. Second candidate, only if that fails: a conditions rule in the prompt, re-tested against frozen case 09 (the v3 attempt regressed it). Judge follow-up for the owner: add "system generates … automatically" to the phrase list as .6, re-validated on the 108 stored answers before use.

## 10. Judge .6 + Office/Vessel pair consolidation comparison + prepared provenance line (owner GO, 15-Sep; `judge6-validation.txt`, `pair-texts.json`, `dedup-*`)

Live and unrelated services unchanged. Same container `sail-assistant-py-exp2` (image `8db669090d36…` prompt-v2, started 04:45:57Z), same index `kb-pilot` 916, same settings; every captured chat body again carries system sha `b37172f6122a0257` = v2, `gpt-4o-mini`, temperature 0.2. Capture on the diagnostic process only; scanned (0 keys / 0 tokens / 0 identity names); removed from the container and server.

### 10.1 Judge .6 — validated on the 108 stored answers first (96 suite + 12 diagnostic)

Changes: (a) automatic-generation wording accepted whenever generate/create and automatic(ally) share a sentence; (b) environment and prerequisite checked together per action — the per-job 'Generate WO' switch must be stated as an office condition ("switch required" alone = incorrect applicability, the ship path has no switch); 'Generate Now' must be placed in the office; the unplanned scope must carry no switch or Sail Admin requirement. Notes are tagged `[missing prerequisite]` / `[incorrect applicability]`. Two defects found and fixed during validation before the version was accepted: the manual file name "For Office_Sail Admin" quoted inside an answer body tripped the unplanned check (5 false hits), and the step parenthetical "(Office: select the vessel)" satisfied the office qualifier for the switch (1 false pass) — both excluded explicitly. Frozen suites and the shared base judge untouched.

| .5 → .6 | count | detail |
|---|---|---|
| rule-level outcome changed | 6 | D2 wo-phr-03 B runs 1–2: "provided the vessel's switch is on" with no office → **incorrect applicability** (correct: that sentence applies the office switch to both instances); diagnostic overview runs generic-01 1 and 3, phr-01 1: "The vessel's switch must be ON for this option" → incorrect applicability; generic-01 overview runs 2–3: "the system generates them/these automatically" now accepted |
| overall PASS/fail changed | 2 | diagnostic overview runs generic-01 run 1 and phr-01 run 1: PASS → fail (switch without the office qualifier). The 96 suite answers: **0 score changes** |

Reported by hand, not judged: phr-01 overview run 3 frames the per-job and unplanned actions as "In the office, …" (office-side framing with the ship path unstated) — passes .6 because the switch is correctly office-qualified there; noted as a precision observation.

### 10.2 Duplicate pairs inspected from the captured texts (`pair-texts.json`)

| pair (Office vs Vessel) | exact differences | decision |
|---|---|---|
| 1.1.5.2 How to create an unplanned work order (p.29 vs p.24) | Office has one extra step "Select the vessel from the 'Vessel' dropdown"; figure numbers 43/44 vs 33/34; Office screenshot callouts are longer (the Vessel ones are one-line summaries); Office carries a "Page 29 of 64" footer. Every Vessel step line has an identical Office line. | consolidate: Office text (superset) + explicit note "Vessel manual (… p.24): the same steps as above, with these differences: Office manual only: 'Select the vessel…'" — both references in the excerpt header and the citation |
| 1.1.5.6 How to complete the work order (p.32 vs p.27) | same pattern: Office-only "Select the vessel" step; figures 49/50 vs 39/40; longer Office callouts; RA note identical (marker `\*` vs `☞`) | consolidate, same form |
| Introduction (p.28 vs p.23) | one word: "Work Orders (WO) are" vs "is" | consolidate; the wording difference recorded in the note |

Eligibility was decided from the texts at run time by the script (Vessel step/sentence lines ⊆ Office lines at ratio ≥ 0.97, screenshot descriptions and figure captions ignored because the Office text is kept whole), not from headings; a pair with any Vessel-only line would have been left separate — none was.

### 10.3 Controlled comparison — NORMAL vs consolidated pairs (`dedup-analysis.txt`, `dedup-capture.jsonl`, `dedup-results.json`)

Arm DEDUP = the served docs path, then eligible pairs consolidated at the first occurrence, freed slots NOT refilled, relative order kept: for "How do I create a work order?" the message went from 5 excerpts (Office unplanned, Vessel unplanned, overview, Office complete, Vessel complete) to 3 (merged unplanned, overview, merged complete); for "different ways" from 5 (overview, Office intro, Office unplanned, Vessel unplanned, Vessel intro) to 3 (overview, merged intro, merged unplanned). The consolidation note is present in every DEDUP wire body (checked). A first attempt consolidated nothing because of a script bug (an unordered-set comparison); its six NORMAL-arm runs are kept as extra baseline data in `dedup-*-attempt1-nodedup.*` and behave like every other NORMAL run.

| question | arm | excerpts | alternatives covered | per-job switch (office-qualified) | Generate Now (Sail Admin + switch, office) | judge .6 |
|---|---|---|---|---|---|---|
| How do I create a work order? | NORMAL | 5 | 0/3 (unplanned only) | not described | not described | 0/3 |
| How do I create a work order? | DEDUP | 3 (overview now at position 2) | **0/3 (unplanned only)** | not described | not described | 0/3 |
| What are the different ways…? | NORMAL | 5 | 3/3 | **0/3** dropped | 3/3 | 0/3 |
| What are the different ways…? | DEDUP | 3 | 3/3 | **0/3** dropped | 3/3 | 0/3 |

Split by kind, DEDUP arm (6 runs): incorrect instruction 0; missing prerequisite 3 (phr-01, per-job switch); missing alternative 3 (generic-01); judge-only 0. One new observation: the DEDUP generic-01 answers state "Select the vessel from the 'Vessel' dropdown" unconditionally and add "These steps are the same as section 1.1.5.2 (page 24) of the Vessel manual" — the consolidation note said that step is Office-only, and the model did not carry the qualifier. Citations in the DEDUP arm list the merged excerpt with both references ("… (p.29) [consolidated with … (p.24)]").

**Finding:** removing the duplicated Office/Vessel sections changed nothing measurable — the same two defects recur 3/3 in both arms, exactly as in the 5-excerpt arm of §9. Duplication alone is therefore NOT the cause. Combined with §9 (overview alone: alternatives 6/6, but prerequisites and Office/Ship applicability preserved in only 3/6 under judge .6 — improved coverage, not a complete success), the remaining difference between the failing and the better-covering conditions is the presence of manual excerpts at all — in particular the manual's own "How to create an unplanned work order" section, whose shape matches the generic question directly — not their duplication, and not the overview's position (position 2 or 1 in DEDUP, still ignored or trimmed). INFERRED from two diagnostics; a third arm (overview + ONE manual excerpt) would isolate "any manual excerpt" from "the unplanned section specifically"; not run.

Per the owner's rule the existing regression suites and the work-order suite were NOT run for this change (no improvement to carry forward).

### 10.4 Prepared, not applied: provenance line for the kb chunks (item 4)

`index_documents.py --kb-provenance-line` (default off; no index set re-built) prepends ONE line to each kb chunk's embedded/answer text; the file:line references stay in `kb_provenance` metadata. Wording corrected 15-Sep (owner): no "reviewed" unless a review is recorded in REVIEW.md. Rendered for the overview file: "Provenance note: draft code-derived guidance, not a published manual. 3 statement(s) come from the June PMS manuals; 7 statement(s) about roles, switches and automatic generation were inspected in the Technical application code at repository revision cf5241ad6; running deployment unverified." Earlier rendering (superseded): "this is a reviewed knowledge-base procedure, not a published manual. 3 statement(s) come from the June PMS manuals; 7 statement(s) about roles, switches and automatic generation were read from the Technical application code at repository revision cf5241ad6 and apply to that revision — the running deployment has not been verified as identical." Applying it re-embeds the five kb chunks (their text changes) and must be measured on its own (frozen suites + work-order suite + capture), separately from any excerpt change. Not bundled into §10.3.

### 10.5 Evidence record corrected (item 5)

`kb3-failures.md` and `failures_kb3.py` now carry the "earlier reconstructed-input report" label, the claim that the reconstruction proves the model input is withdrawn, and the 3,000-character statement is corrected (tool path only); the wire captures (`diag-capture.jsonl`, `dedup-capture.jsonl`) are identified as the verified evidence.

### 10.6 Recommendation

Do not pursue deduplication further as a fix — it is measured as no-effect here. The smallest next diagnostic (not a fix, not implemented): one more arm, overview + the single manual unplanned section, three runs each on the two questions, to settle whether any manual excerpt or that specific section triggers the drop. If the drop follows the unplanned section, the candidate fixes become either a prompt rule for conditions (re-tested against frozen case 09, which v3 regressed) or a retrieval rule that prefers a KB procedure over a manual section covering the same action — both need the owner's decision. Judge .6 should be the scoring version from here; the provenance line (§10.4) is ready to apply as its own measured step.

## 11. Prompt v4 candidate — replayed on the exact captured five-excerpt contexts (owner GO, 15-Sep; `prompt-*`, `diag_prompt.py`)

Corrections applied first (owner): §9.5 and §10.3 no longer call overview-only a success (coverage improved; prerequisites and Office/Ship applicability preserved in only 3/6 under judge .6); the prepared provenance line now reads "draft code-derived guidance … inspected repository revision cf5241ad6; running deployment unverified" (§10.4) and stays separate from this comparison.

### 11.1 What was compared

- **Contexts:** the two NORMAL-arm user messages captured in §9 (5 excerpts, no consolidation), replayed byte-for-byte — sha `ef40f46331cd52c8` (6,417 chars, "How do I create a work order?") and `57816b0740f3a644` (5,095 chars, "What are the different ways…?"); every captured wire body in this run carries exactly that user message (checked).
- **Prompts:** v2 = the served docs system text taken verbatim from the wire, sha `b37172f6122a0257`; v4 = `v4-coverage-conditions-2026-09-15`, docs sha `2ba207300d32aaff`, tool-loop sha `8169b8a781f487eb`, combined `fdc38ecc07d10d3e` (branch `app/retrieval.py` / `app/agent.py`; v3 superseded). v4 keeps v2's "not covered" rule and the cross-reference HARD RULE verbatim and adds: a coverage rule (broad question → every supported method, never a silent single-method answer; named method → that method plus a one-line note of the others), a conditions rule (environment, role, configuration conditions and steps kept together per action; an omission in another source is not a contradiction), a sources rule (manual vs draft code-derived guidance, conflicts stated, neither authoritative by default, draft/unverified/revision-specific flagged in one clause) and a compact per-method format (Method — Applies to, only when stated — Requirements — Steps, cross-reference statement kept inside the steps — Source). Nothing work-order-specific; no ERP change.
- **Everything else identical:** same container/image (`8db669090d36…`, prompt-v2 image; the system text is supplied per call), `gpt-4o-mini`, temperature 0.2, masking path; capture on the diagnostic process only; 12 chat bodies, scanned clean, removed from the server. 3 runs per question per prompt.

### 11.2 Results — judge .6 and source-backed reading (`prompt-analysis.txt` has every full answer)

Judge .6 scores 0/6 for v2 and 0/6 for v4. That figure is not usable on its own: the v4 format defeats the judge in three ways (§11.3). The source-backed reading against the overview text and manual p.29 is:

| question | prompt | alternatives covered (of planned-automatic / Generate Now / per-job / unplanned) | per-job switch stated as an office condition | Generate Now with Sail Admin + switch, office | new defects introduced |
|---|---|---|---|---|---|
| How do I create a work order? | v2 | 1 of 4, 3/3 runs (unplanned only) | not described | not described | — |
| How do I create a work order? | v4 | runs 1–2: **3 of 4** (Generate Now absent); run 3: 1 of 4 | runs 1–2 ✓ ("Requirements: vessel's 'office work-order generation' switch ON, job must be active…", Applies to: Office) | 0/3 — absent in every run | run 3 adds "planned and per-job work orders … are not covered in the excerpts provided" — **false**, the overview excerpt at position 3 covers them; per-job labelled "Applies to: Office" 2/2 (ship path, which needs no switch, omitted) |
| What are the different ways…? | v2 | 4 of 4, 3/3 | 0/3 dropped | 3/3 | — |
| What are the different ways…? | v4 | 4 of 4, 2/3 (run 2 drops Generate Now) | **3/3** ✓ | 2/3 | **fabricated cross-reference statements** in runs 1 and 3 ("(Cross-reference resolved: the steps for planned work orders are the same as section planned-wo-ship-daily-scan.md.)", same for unplanned-wo.md, "details in … office-generate-now.md") — the overview only says "Details: <file>.md"; no resolved cross-reference exists in the context; per-job "Applies to: Office" 3/3 and unplanned "Applies to: Office" 2/3 (both apply to ship too per the overview and the Vessel manual excerpt) |

Split by kind, v4 (6 runs): unsupported or incorrect instruction 0; **incorrect statement** 3 runs (1 false "not covered", 2 runs with 3 fabricated cross-reference attributions); missing prerequisite 0 (the per-job switch is now stated, office-qualified, in every run that describes per-job); missing alternative 4 runs (Generate Now absent in generic-01 ×3 and phr-01 run 2); **incorrect applicability** 5 runs (per-job and/or unplanned narrowed to "Office"); judge-only see §11.3. Minor: "Requirements: none stated in the excerpts" for planned/unplanned where the overview's prerequisites line does state "a job with an active work order cannot get another one"; answers are about twice as long. The sources rule produced no conflict/draft clause — expected, the kb excerpts carry no draft/revision marker in their text until §10.4 is applied.

### 11.3 Judge-only failures (reported, scoring not modified)

Judge .6 was validated on v2-format answers; on the v4 format it fails for reasons that are not answer defects: (1) the per-method "Requirements" line precedes the step that names the action, so the condition lies BEFORE the action scope opens (the documented .5 limitation) → false "Generate WO block lacks the vessel switch" in 5 v4 runs; (2) a method heading that does not name an action ("Method 2: Create a Work Order per Job") is appended to the previous scope → false "unplanned wrongly requires the switch" in generic-01 runs 1–2; (3) `body_of` cuts the answer at the first line starting with "Source:" — the v4 format writes one per method → generic-01 run 3 and phr-01 run 3 were judged on their first method only (false "not described" / missing must-phrases). A format-aware .7 (scope = method block from its heading; Source lines per method ignored) would be needed before v4-format answers can be scored automatically; not written.

### 11.4 Decision

The diagnostic improves the two targeted defects on these contexts — broad-question coverage (generic-01 1→3 methods in 2/3 runs) and the per-job switch as an office condition (phr-01 0/3→3/3) — but it **introduces defects**: fabricated cross-reference attributions (a direct breach of requirement 4), narrowed Office-only applicability for actions that also apply on the ship, one false "not covered" statement, and Generate Now dropped from the generic answer 3/3. Per the owner's rule ("improves correctness without introducing defects") the regression suites and the work-order phrasings were **not run**; nothing built, nothing deployed. v4 stays on the branch as a candidate label only; the served prompt is v2.

### 11.5 Recommendation (not implemented)

The evidence points at two specific v4 wording faults, not at the approach: (a) the "Applies to" field forces a choice the excerpt does not always make — drop it, or allow it only as a quotation of the excerpt's own "Applies to"/"ON THE SHIP / IN THE OFFICE" wording; (b) the format sentence "keep any required cross-reference statement inside the steps" plus the hard rule's fixed phrase invites the model to manufacture "(Cross-reference resolved: …)" from plain "Details: <file>" pointers — the hard rule must say the statement is made only when the excerpt itself contains the resolved-cross-reference text, never otherwise. A v5 with those two changes, replayed on the same two captured contexts with a format-aware judge .7, is the smallest next test; only if it introduces no defect should the suites (case 09 first) and the eight phrasings run.

## 12. Judge .7 + prompt v5 replay (reviewer plan, owner forward, 15-Sep; `judge7-validation.txt`, `prompt5-*`)

Live unchanged. Same container/image, model settings and masking path as §11; capture on the diagnostic process only, scanned clean, removed from the server.

### 12.1 Judge .7 — format-aware parsing, acceptance requirements unchanged

Fixed before any new model call, on the 132 stored answers (96 suite + 12 overview diagnostic + 12 consolidation + 12 v4 replay): (a) source lines and "(Source: …)" parentheticals are removed wherever they sit instead of cutting the answer at the first one; (b) scopes are built from method blocks — a block naming one action is attributed whole (its requirements line included, wherever it sits), a heading block naming no action is held for the NEXT action, a block naming several actions falls back to the .5 unit scoping; (c) the "framed in the office" test skips bare headings and enumerators. Two intermediate defects were caught by the validation and fixed before acceptance (the first cut of (b) moved two v2-format verdicts because the heading became the "first unit").

| .6 → .7 | count | detail |
|---|---|---|
| rule-level outcome changed | 5 | all five are v4-format answers: the false "Generate WO block lacks the vessel switch" (requirements line before the step) and the false "unplanned wrongly requires the switch" (method heading appended to the previous scope) are gone; what remains is real (Generate Now absent in generic-01 runs 1–2 and phr-01 run 2) |
| overall verdict changed | 2 | phr-01 v4 runs 1 and 3: fail → PASS on the .6 acceptance set (verified by reading: per-job switch office-qualified, Generate Now with Sail Admin + switch in the office). Their fabricated cross-reference statements and "Applies to: Office" narrowing are outside the judge's acceptance set and stay manual criteria — not added to the judge |
| the 120 earlier answers | 0 changes | every .6 verdict kept |

### 12.2 Prompt v5 (`v5-plain-coverage-2026-09-15`, docs sha `ff9ee87141ac1362`, tool-loop `7a028346c1c2fdf0`, combined `aea94e2f5edb6948`)

v2's rules and the cross-reference hard rule verbatim, plus: the "same as section X" statement is made ONLY when an excerpt itself contains the resolved text — a "Details: <file>" or "see section X" pointer is a link, not evidence of identical steps, never write "(Cross-reference resolved: …)" on your own; broad question → first a brief list of every supported method including those nested inside an overview excerpt, then each explained; plain numbered explanations with requirements next to the method (role, Office/Ship applicability, switches, record state), Office/Ship differences stated wherever the source makes them; the sources rule; no Method / Applies to / Requirements labels; ONE final source list attributing each method. Replayed on the same two captured contexts (user sha `ef40f46331cd52c8`, `57816b0740f3a644`; every wire body checked against its prompt sha and context sha), 3 runs each, v2 alongside.

### 12.3 Results (`prompt5-analysis.txt` has every full answer)

| criterion (reviewer's pass bar) | v2 (6 runs) | v5 (6 runs) |
|---|---|---|
| complete method coverage — planned-automatic, office Generate Now, per-job Generate WO, unplanned | generic-01 0/3 (unplanned only); phr-01 3/3 | **6/6** — the generic question now lists all three methods with Generate Now inside the planned item in every run (v4 had 0/3 for Generate Now) |
| no invented references | 0 fabricated (the v2 generic answers' "same as section 1.1.5.2 (page 29)" refers to the section they quote — self-reference, not a manufactured cross-reference) | **0 fabricated**, no "(Cross-reference resolved: …)" text, no labels; one final source list in 4/6 runs (phr-01 runs 2–3 also add per-method source lines and a summary line) |
| Generate Now with Sail Admin + switch, in the office | 3/6 (phr-01 only) | **6/6** |
| per-job Generate WO switch present | phr-01 0/3, generic-01 n/a | 4/6 — **missing in generic-01 runs 1–2** ("Note: the job must be active and must not already have an active work order" / "does not require a specific role but does require the job to be active…", no switch) |
| per-job switch stated as an OFFICE condition | — | **0/6 under judge .7** — in the 4 runs that state it the wording is "- Office: Select the vessel → … click 'Generate WO' … There is no role check, but the vessel's switch must be ON" — the "Office:" marker prefixes the step chain (as the overview's "(Office: select the vessel)" does) and the switch sentence itself is unqualified; by a lenient reading the whole bullet is office-framed, by the owner's rule ("switch required" ≠ "switch required on the office instance") it is not explicit |
| Office/Ship applicability elsewhere | — | unplanned "both Office and Ship" stated in generic-01 runs 1–2; per-job described only for the office path in all runs (ship path, which needs no switch, unstated — omission, not a false statement); no "Applies to: Office" labels |
| incorrect instructions or statements | 0 | 0 (minor: phr-01 run 2 "unplanned … can be created without any prerequisites" over-generalises "no role check, no switch") |
| judge .7 rule | 0/6 | 0/6 (2 missing prerequisite, 4 incorrect applicability) |

### 12.3a Corrected reading of the v5 answers (owner rule 15-Sep: an Office label governing an entire procedure qualifies its conditions; one attached only to vessel selection cannot) — `prompt5-analysis.txt`

| run | methods | per-job prerequisites | Office/Ship applicability | unsupported claims | citations | judge .7 | judge .8 |
|---|---|---|---|---|---|---|---|
| generic-01 v5 r1 | 4/4 ✓ | **missing condition** — per-job states only "the job must be active and must not already have an active work order"; the switch is absent | per-job "(available in Office)" governs the whole procedure but the ship path (no switch) is unstated → ambiguous; unplanned "(both Office and Ship)" ✓; planned "Ship automatic / Office Generate Now" ✓ | none | per-method, supported ✓ | ✗ real | ✗ real |
| generic-01 v5 r2 | 4/4 ✓ | **missing condition** — "does not require a specific role but does require the job to be active…", no switch | per-job "In the office, the steps are:" governs the procedure, ship path unstated → ambiguous; unplanned "both Office and Ship" ✓ | none | supported ✓ | ✗ real | ✗ real |
| generic-01 v5 r3 | 4/4 ✓ | switch present ("the vessel switch must be ON") | **ambiguous applicability** — the only Office label is "- Office: Select the vessel." as its own step, so it cannot qualify the switch sentence | none | supported ✓ | ✗ real | ✗ real |
| phr-01 v5 r1 | 4/4 ✓ | ✓ "- Office: Select the vessel → … click 'Generate WO' → … There is no role check on this path, but the vessel's switch must be ON, and the job must be active…" — the label opens the whole procedure line → qualified | unplanned "- Office: Select the vessel → Click '+ Unplanned W.O' …" frames unplanned as an office procedure; the Vessel manual excerpt in the context has no such step → **ambiguous** (ship path unstated) | none | supported ✓ ([1] overview, [2]/[3] manuals) | ✗ **judge-only** (framing test needed "in the office") | ✓ |
| phr-01 v5 r2 | 4/4 ✓ | ✓ same construction | unplanned office-only framing → ambiguous | **"Unplanned work orders — These can be created without any prerequisites."** — the source says no role check and no switch; "no prerequisites" is broader (owner rule: "no role check on this route" must not become "no prerequisites") | supported ✓ ([1], [3], [4] match the context indices) | ✗ judge-only | ✓ |
| phr-01 v5 r3 | 4/4 ✓ | ✓ same construction | unplanned office-only framing → ambiguous | "can be created at any time" — minor, unsupported wording | supported ✓ | ✗ judge-only | ✓ |

Totals, v5 (6 runs): missing condition 2 · ambiguous applicability 6 (per-job in generic-01 r1–r3; unplanned in phr-01 r1–r3) · unsupported claim 1 (+1 minor) · judge-only 3 under .7, 0 under .8 · runs meeting all four requirements: **0/6**. v2 on the same contexts: generic-01 r1–r3 missing methods (unplanned only; its "same as section 1.1.5.2 (page 29)" is a self-reference to the quoted section, not an invented cross-reference — the analysis flag over-counted it); phr-01 r1–r3 missing condition (per-job switch absent), "(Office: select the vessel)" attached to vessel selection only.

Judge .8 (`judge8-validation.txt`): parsing only — a unit that opens with "Office:" / "in the office" AND carries the action qualifies; a bare "Office: select the vessel." step does not. Validated on all 144 stored answers: exactly three changes, phr-01 v5 r1–r3 fail → PASS; generic-01 v5 r3 stays a fail; the other 138 verdicts unchanged. The judge still does not detect the unplanned office-only framing or the "no prerequisites" claim — those stay manual criteria (not added, so the factual bar is not relaxed by the judge either way).

### 12.4 Decision

v5 removes every defect v4 introduced (no fabricated references, no labels, no false "not covered", Generate Now present 6/6) and fixes coverage 6/6 — but it does **not** meet the bar "correct conditions and applicability": the per-job switch is dropped in 2 of 6 runs and, where present, is never stated explicitly as an office condition. Under the strict reading the replay fails; under the lenient reading it fails 2/6. Either way the pass condition for running case 09 and the broader suites is not met, so they were **not** run, nothing was built, nothing deployed. v5 stays on the branch as the candidate label; the served prompt is v2.

### 12.5 What this settles and what comes next (per the reviewer's stop rule)

Two prompt versions on identical captured inputs show the same residual: gpt-4o-mini at T=0.2 keeps the Generate Now conditions reliably but treats the per-job switch clause ("in the office only if the vessel switch is on", sitting mid-sentence between "No role check on this path (…)" and "the job must be active…") as droppable or re-orders it away from its qualifier, in 2–6 of 6 runs depending on the reading, whatever the prompt says about conditions. The reviewer's rule applies: stop cycling prompt wording. The next decision is a comparison of a different answer-generation approach or model on these SAME captured inputs — the replay harness (`diag_prompt.py` + the captured contexts) can run any prompt text; a model change (`CHAT_MODEL`) or a two-step generation (extract per-method conditions first, then write) would each need the owner's authorisation and a cost/latency note before running. Not started.

## 13. Planned: alternative answer model on the same captured inputs (owner GO 15-Sep; NOT started — awaiting model access)

Scope: candidate only; prompt v5 and the two captured contexts unchanged; `diag_prompt.py` replayed inside the same container with `CHAT_MODEL` overridden for that process only (the running service keeps `gpt-4o-mini`); wire capture on; judge .8 plus a full reading against the evidence (methods, action-specific prerequisites, Office/Ship applicability, supported citations; "no role check" ≠ "no prerequisites"). Recorded per run: model identifier from the wire body, temperature and timeout as sent, prompt/completion tokens from the response usage, latency, and cost computed from tokens at the published list price (the price used is quoted in the record so it can be verified against the account's actual billing — the API key cannot read billing).

Model requested: **`gpt-4.1`** (same API family, supports temperature 0.2 so the settings stay like-for-like; stronger instruction following than gpt-4o-mini). Second choice if 4.1 cannot be enabled: `gpt-4o`. Reasoning models (o-series / gpt-5) would not be like-for-like — they do not accept the temperature setting. The key is a restricted project key: `models.list` returns 403 (missing `api.model.read`), so availability was not probed with test calls.

Estimated cost, list prices as known 15-Sep (gpt-4.1: $2.00 per 1M input tokens, $8.00 per 1M output; gpt-4o: $2.50 / $10.00):

| step | calls | tokens per call (approx.) | gpt-4.1 | gpt-4o |
|---|---|---|---|---|
| replay, 2 questions × 3 runs | 6 | ~2,200 in / ~500 out | ~$0.05 | ~$0.06 |
| only if the replay passes: frozen 12 ×3 + corrected 14 ×3 + WO 8 phrasings ×3 + retrieval 18 (+ embeddings) | ~120 | ~2,500 in / ~400 out | ~$1.0 | ~$1.3 |

Pass condition for the replay: every run — correct methods, action-specific prerequisites incl. the per-job office switch, Office/Ship applicability where the source makes it, supported citations, no invented references, no "no prerequisites"-type claims. The replay does not test the phrasings where retrieval misses the overview (wo-generic-03, wo-phr-02); those stay retrieval failures whatever the model does.

### 13.1 New dedicated assistant key checked (15-Sep, evening) — PROVEN by minimal probes, key never printed

The owner created a dedicated key for the assistant (file `central-assistant/newchatbotkey.txt`, untracked; a `.gitignore` rule was added so it can never be committed), scoped to `gpt-5.6-luna` and `text-embedding-3-large`. Probes from the build machine (5 calls, ~30 tokens total):

| probe | result |
|---|---|
| `models.list` | 403 — restricted key, no `api.model.read` (as with the borrowed key) |
| chat `gpt-5.6-luna`, no temperature | OK — "OK", 13 prompt / 4 completion tokens, 2.5 s |
| chat `gpt-5.6-luna`, temperature 0.2 | **400 — "'temperature' does not support 0.2 with this model. Only the default (1) value is supported."** |
| chat `gpt-4o-mini` | **403 — the new project has no access to `gpt-4o-mini`** |
| embeddings `text-embedding-3-large` | OK — 3072 dimensions (same as the index), 1 token |

Consequences: (1) the comparison cannot keep the served model settings — the service sends temperature 0.2 (`agent._model_settings`) and this model rejects it, so a replay on gpt-5.6-luna must omit temperature (default 1) and is therefore not like-for-like on that setting; the served code would need a model-dependent settings change before this model could serve; (2) the new key cannot run the current live model at all — moving live to the dedicated key means moving live to gpt-5.6-luna, which is unmeasured; live stays on the borrowed key and gpt-4o-mini until that is measured and approved; (3) SMS RAG (prod 13.250.9.130 and dev) runs gpt-4o-mini for chat/rerank/rewrite and text-embedding-3-large for embeddings — the same as the assistant today. Price (READ from OpenAI's model page and OpenRouter via web search, not verified against billing): gpt-5.6-luna is the smallest of the GPT-5.6 family (Luna / Terra / Sol) at about $0.20 per 1M input and $1.20 per 1M output tokens — a gpt-4o-mini-class model, not a larger one. Estimated cost of the replay: about $0.01 for 6 calls; the suites, if reached, about $0.15. Not started — awaiting the owner's decision on the temperature difference.

### 13.2 Replay on gpt-5.6-luna — PASSED 6/6 (owner decision 1: default temperature; `luna-analysis.txt`, `luna-capture.jsonl`, `luna-results.json`)

Environment (PROVEN from the wire): same container/image as §11–§12 (`8db669090d36…`), the exec'd process given the new dedicated key via a 600-permission env file that was deleted afterwards; every captured body: `model: gpt-5.6-luna`, **no temperature parameter sent** (the model rejects any non-default value), system sha `ff9ee87141ac1362` = v5, user sha = the captured contexts (`ef40f46331cd52c8`, `57816b0740f3a644`), prompt v5 and contexts byte-identical to §12. Latency 6.5–11.0 s per answer (mean 8.2 s; gpt-4o-mini 2–4.4 s). Token usage came back empty — cause found and fixed afterwards (§13.3), so cost is estimated from sizes: ~2,300 prompt + ~600 completion tokens per call, 6 calls ≈ $0.007 at $0.20 / $1.20 per 1M (list price READ from the web, not billing).

| run | methods (planned-auto / Generate Now / per-job / unplanned) | per-job prerequisites | Office/Ship applicability | unsupported claims | citations | judge .8 |
|---|---|---|---|---|---|---|
| generic r1 | 4/4 | "There is no role check, but **in the office** the vessel's office work-order generation switch must be ON. The job must be active and must not already have an active work order." | per-job "In the office, select the vessel"; unplanned "In the office, select the vessel"; planned Ship/Office split; Generate Now Sail Admin + switch + settings location | none ("Normal sign-in and vessel access are required" — the overview's wording, not "no prerequisites") | per method: KB guidance for planned/per-job, both manuals §1.1.5.2 p.29/p.24 for unplanned | ✓ |
| generic r2 | 4/4 | same, explicit "in the office" | unplanned "applies to both Office and Ship"; "In the office, nothing runs automatically" | none | ✓ | ✓ |
| generic r3 | 4/4 | same | unplanned step 2 adds "The vessel-specific instructions do not include this selection step" — the Office/Ship difference stated from the two manual excerpts | none | ✓ (manual §, page) | ✓ |
| different-ways r1 | 4/4 | same | Ship/Office split for planned; "In the office, select the vessel" for per-job and unplanned | none | ✓ | ✓ |
| different-ways r2 | 4/4 | same | same | none | ✓ (per section of the KB guidance) | ✓ |
| different-ways r3 | 4/4 | same | same, plus "Office generation does not run automatically" | none | ✓ | ✓ |

Every answer also carries a source-difference sentence ("The June Office and Vessel manuals … do not state the office conditions … those come from the KB pilot guidance") — the v5 sources rule working as intended and supported by the overview's own "Where the manual differs" line. No invented cross-reference, no labels, one final source list per answer. Manual verification: all six read against the overview text and manual p.29 — no missing condition, no ambiguous applicability, no unsupported claim. **Pass condition met → the suites were run (§13.4).**

### 13.3 Two service-code changes made for the candidate (branch only; live image unchanged)

- `CHAT_TEMPERATURE` setting (default "0.2" = served behaviour; "default" = send no temperature) in `app/config.py` / `app/agent.py`; `/health` now reports `chatModel` and `temperature` so the record shows what a container sends.
- Token usage bug: in pydantic-ai 2.42 `AgentRunResult.usage` is a property; the service called it as a method, the exception was swallowed and every conversation row since the port logged `tokens_in/out = None` (also why the replays recorded no usage). Fixed to handle both shapes (`app/agent.py:_usage`). Telemetry only; no answer behaviour change.

Candidate container `sail-assistant-py-luna` on 127.0.0.1:8020 (image `sail-assistant-py:prompt-v5` 8b1d2ddfb910, built from the branch on the server; health: prompt v5 hashes, `chatModel gpt-5.6-luna`, `temperature default`, index `kb-pilot` 916). Its env file `~/central-assistant/assistant-luna.env` (600) holds the new key — decision surfaced: the dedicated key now exists on the AI server in that one file, used by this candidate only; live keeps `assistant.env` with the borrowed key. Suites run from the bridge network by container name (the DB host resolves only there).

### 13.4 Suites — candidate B (8020: prompt v5 + gpt-5.6-luna, default temperature, new key) vs A (8018: prompt v2 + gpt-4o-mini, T=0.2), both on `kb-pilot` 916 (`luna-runs.txt`, `luna-*-dump.jsonl`; run 11:58–12:10 UTC)

| suite | A | B (judge) | B by reading |
|---|---|---|---|
| retrieval 18 (expectations v1 and v2) | 18/18 | 18/18 | — (identical distances; retrieval does not depend on the answer model) |
| frozen 12 (.3), 3 runs, joint | 11/12 | **11/12** | same case fails on both: 05 hazard categories → routing `clarify` gate, unchanged since §S.6 |
| **case 09** (cross-reference attribution) | 3/3 | **3/3** | "follow the same steps as 'How to create a new defect'… (p.15)" — attribution kept; the v3 regression does not recur |
| corrected claims 14 (.2), 3 runs | 12/14 | 12/14 | **13/14** — gen-04 fails on both (known test-string defect); gen-01 fails on B by word match only: the answer says "the system generates a code on import" and the judge requires the literal "generated" (3/3 runs; run 3 also lacks the literal "optional" while saying "leave Job Code blank… the system accepts it") — correct by meaning, judge-only. A's gen-13 1/3 is A's own run-to-run variation |
| work-order 8 phrasings (.8), 3 runs, all runs required | 1/8 | **4/8** | **6/8** — see below |

Work-order phrasings on B, every failing run read against the overview text and manual p.29 (`luna-wo-dump.jsonl`):

| case | B judge | reading | classification |
|---|---|---|---|
| wo-generic-01 How do I create a work order? | 2/3 | 3/3 — run 3 states "In the Office, the vessel's office work-order generation switch must be ON" in the per-job block, before its numbered steps | **judge-only**: a blank line separates the heading from its requirements bullets, so the .8 block parser attaches those bullets to the previous action |
| wo-generic-02 planned… myself? | 3/3 | 3/3 | pass |
| wo-generic-03 How to create work order in PMS? | 0/3 | 0/3 — the five excerpts contain no overview (manual intro ×2, unplanned ×2, completion); the answer correctly says "The excerpts do not describe how to create a planned or scheduled work order" and gives the Office and Ship unplanned procedures | **retrieval failure**, recorded separately as the owner required; not a model defect. Run 3 labels the office procedure "Office / Sail Admin" (from the manual's file name) — an unsupported role implication, minor |
| wo-phr-01 different ways | 3/3 | 3/3 | pass |
| wo-phr-02 raise a work order for a pump | 0/3 | 0/3 for the judge's "note of the other ways" — the excerpts (manual unplanned ×2, completion ×2, KB unplanned chunk) contain no other way; the answers give the unplanned procedure with an explicit Office/Ship split and the KB chunk's "no role or switch check… normal authentication and vessel access" | **retrieval failure**, recorded separately; the answers themselves are correct and complete for the supplied evidence |
| wo-phr-03 myself or the system | 3/3 | 3/3 | pass |
| wo-phr-04 steps to create | 3/3 | 3/3 (with the overview at rank 4 the answer lists all three ways) | pass |
| wo-phr-05 how do work orders get created | 2/3 | 3/3 — run 1: per-job "no special role. In the Office, the vessel's … switch must be ON" ✓; the judge's "Sail Admin wrongly attached to Generate WO" comes from the per-method source bullet "*PMS User Manual For Office_Sail Admin_R2…*, p. 18" (the .8 "sail admin" check reads the raw scope, the file-name exclusion applies only to the negation check). Run 1 also opens with "supports four ways" then lists three — a wording slip | **judge-only** (+ one wording slip) |

Judge .8 gaps found by this run, reported and NOT changed: (1) requirements bullets separated from their heading by a blank line are attributed to the previous action; (2) the raw-scope "sail admin" check is triggered by a manual file name inside a per-method source bullet. Both would need a .9 validated on the stored answers before use.

Actual usage of the candidate over the suites, from the conversation log (usage recording works after §13.3):

| | B gpt-5.6-luna | A gpt-4o-mini |
|---|---|---|
| answered rows | 99 | 105 |
| prompt / completion tokens | 153,300 / 38,939 | not recorded (A runs the old image with the usage bug) |
| cost at the list price ($0.20 / $1.20 per 1M, READ from the web) | **≈ $0.077** | — |
| latency, mean / max | 5.3 s / 10.5 s | 2.5 s / 7.0 s |

### 13.4a Corrections after the reviewer's check of §13.2–§13.4 (15-Sep, reviewer points 1–5)

1. **"No unsupported claims" in §13.2 was too strong.** Re-read: replay generic run 3 says of the per-job path "This path is not described in the June manuals" and, two paragraphs later, "The June Office and Vessel Specific manuals describe only the on-demand and unplanned procedures" — a contradiction inside one answer; the overview supports the second statement (the manuals describe the per-job button on p.18), and the correct form of the first would have been "not described in these excerpts". Replay generic run 2 carries a garbled sentence ("document the unplanned procedure and the per-job procedure is not described in those excerpts"). Corrected count for the six replay answers: conditions and coverage 6/6, **unsupported or inconsistent statements in 2 of 6** (both in the source-comparison sentence, neither in the procedures themselves).
2. **Retrieval distances are not entirely identical.** 17 of 18 distances are identical; "how do I raise a lesson learnt" is 1.0129 on A vs 1.0145 on B — the live question embedding varies slightly run to run (also seen on 14-Sep, 0.7847 vs 0.7845); ranking and manual are unchanged. And the equal corrected-suite totals (12/14) hide a scored loss on gen-01 (B 0/3, word-match only, answers quoted below) and a gain on gen-13 (A 1/3, B 3/3). The full corrected-suite answers are in `luna-generated-dump.jsonl` (now in the evidence set). B's gen-01 answers: run 1 "No. For Jobs, the Job Code column is optional: 1. Leave it blank; the system generates a code on import in the format `JOB-XXXXXXX`…"; run 2 same; run 3 "No. In Bulk Data Import for Jobs (Office / Sail Admin): 1. Leave Job Code blank if you do not have one; the system accepts it and generates a code such as `JOB-XXXXXXX` during import…" — the expected claim (Job Code optional, generated on import) is stated in every run; the judge's literal "generated" is not.
3. **The pump answers assume unplanned work.** wo-phr-02 B: "To raise a work order for the pump, create an unplanned work order" (run 1) — the excerpts hold no other method, which explains but does not justify the assumption; a faithful answer would say the excerpts describe only the unplanned method. Classified now as a **real answer defect (unsupported assumption)** on top of the retrieval miss, in all three runs.
4. **The tested package includes the five KB files** (`kb-pilot` 916) — the results do not establish that switching only the live model and prompt on `repaired` 911 gives the same gains, and the draft/revision/deployment provenance line (§10.4) has not yet reached the model. Both remain to be measured before any package is proposed (§13.6).
5. **"$0.00000" in `luna-analysis.txt` relabelled** "usage UNAVAILABLE … the call was NOT free" with a per-call estimate; the file is regenerated.

**Judge .9** (parsing only, `judge9-validation.txt`): (a) a requirements block that follows a held heading travels with it to the next action; (b) the "Sail Admin wrongly attached" check ignores quoted manual file names. Validated on all stored answers (192 incl. the luna suite): exactly the two intended verdicts change (wo-generic-01 B run 3, wo-phr-05 B run 1 → PASS); nothing else moves. Candidate work-order score under .9: **6/8** (wo-generic-03 and wo-phr-02 remain — retrieval, plus the pump assumption above).

### 13.5 Result and what is now the owner's decision

On identical retrieval, the v5 prompt + gpt-5.6-luna candidate keeps every existing suite (retrieval 18/18, frozen 11/12 with case 09 3/3, corrected 13/14 by reading) and lifts the work-order phrasings from 1/8 to 4/8 by judge and 6/8 by reading; the two remaining misses are retrieval (the overview is not among the five excerpts for those phrasings) and were never in scope of an answer-model change. Answers are about twice as slow (5.3 s mean) and ~1.5–2× longer. No deployment has been made and none is authorised. What would change if the owner chose to promote this candidate: (a) live moves to the dedicated key and therefore to gpt-5.6-luna (the key cannot serve gpt-4o-mini) with `CHAT_TEMPERATURE=default`; (b) the served prompt becomes v5 (`ff9ee87141ac1362`); (c) the served index stays `repaired` 911 unless the KB pilot files are promoted too — the suites above ran on `kb-pilot` 916, so a promotion of the model/prompt alone would need one confirming run on `repaired`; (d) the borrowed SMS-RAG key is retired from `assistant.env`. Rollback = nginx back to the current container, as before.

### 13.6 Reviewer's next direction — plan, NOT started (owner decision needed on the retrieval step)

Direction received 15-Sep: keep gpt-5.6-luna and v5; correct the report and judge (done, §13.4a); address the two retrieval misses in a candidate; apply the prepared provenance notice; verify the exact proposed deployment package against the suites; live untouched.

**A. The two retrieval misses — what is measured and the options.** Overview rank in the top-8 probe (`kb3-rank.txt`, one-chunk index): "How to create work order in PMS?" — not in the top 8 (the manual's Office intro p.28 and unplanned section p.29 lead at 0.733/0.751); "raise a work order for a pump" — rank 8 (the KB unplanned chunk at 4). Neither is reached by the five excerpts, so no answer-model change can fix them. Options, each a retrieval-logic change on the candidate only, each to be measured with the 18-query suite (must stay 18/18) and the eight phrasings:
1. **Hybrid lexical boost**: the `tsvector` column exists but is unused ("create work order" matches the overview's title and body); fuse a lexical score into the ranking. Most likely to lift both phrasings; a real ranking change with the widest blast radius — needs the full suites.
2. **One excerpt per manual section** (Office/Vessel duplicates collapse, freed slots refilled from ranks 6–8): §10 showed consolidation alone changes nothing for the model, but here the freed slots would pull the overview in for the pump phrasing (rank 8) — not for "How to create … in PMS?" (outside the top 8).
3. **Reranker** — approved in principle on 11-Sep as its own measured step, not yet built.
Recommendation: option 1 as the smallest change that can reach both misses; the owner decides.

**B. Provenance notice — apply as a separate index set.** Build `kb-pilot-prov` = `kb-pilot` + the five KB chunks re-embedded with `--kb-provenance-line` ("draft code-derived guidance … inspected repository revision cf5241ad6; running deployment unverified"), point a candidate at it, capture one request to confirm the line reaches the model, then the suites (≈$0.08). Expected effect: the v5 sources rule should make answers say the office conditions come from draft code-derived guidance at that revision.

**C. Deployment package verification.** Whatever package the owner chooses — (i) model + prompt + key on `repaired` 911, or (ii) the same plus the KB files with the provenance line — run the full suites on exactly that configuration before any promotion; nothing so far has tested (i).

## 14. Owner brief of 15-Sep (six steps) — candidate instances only; live, nginx, SMS RAG, shared credentials untouched

### 14.1 Step 1 — owner's clarification recorded

Owner confirmation (Ghazi Anwer, 15-Sep-2026): the running Technical application and the inspected code are the same — Technical repository `origin/replit_dev` cf5241ad6. Recorded as the owner's confirmation, not as an independently measured deployment check. Applied in: `kb/technical/work-orders/REVIEW.md` (reviewer note), `kb/technical/work-orders/CONFLICTS.md` (header), the indexer's `--kb-provenance-line` text (now: "draft code-derived guidance, not a published manual … inspected in the Technical application code at repository revision cf5241ad6, which the application owner has confirmed is the code running in the Technical application. Where this guidance and a manual differ, say which source says what."). Removed everywhere: the blanket "running deployment unverified" statement. Kept: the `[code: …]` / `[manual: …]` distinction, every source reference, the review status (all rows "Converted"), and CONFLICTS.md rows 1–6 — where code and manual disagree the specific difference stays documented; neither side is chosen silently. The corrected code-derived Technical documents (R3/R3.1 `.docx`) carry no deployment-verification wording; `PROVENANCE.md` cites repository revision 27a40b2ce for their claims (unchanged).

### 14.2 Step 2 — three source sets (same model gpt-5.6-luna, prompt v5 `ff9ee87141ac1362`, default temperature, retrieval settings answer_chunks 5 / top_k 10 / floor 1.15 / margin 0.07)

Source inventory. The 20 official PDFs in `D:\manuals` (recursive) hash-match the server corpus byte for byte (sha256[:16] below). The five corrected code-derived Technical documents and the five KB pilot files are different things and are listed separately.

| set | index set (chunks) | built from | contents |
|---|---|---|---|
| **A** manuals only | `manuals-only` (855, 20 documents) | `documents-manuals/` = the 20 official PDFs; `--apply-repairs --resolve-xrefs`; parses reused from the parse store (`assistant_parses`, 60 rows; parser never called); **855/855 vectors reused from `kb-base` (0 embedding calls)** | Audit ×4 (b5252752ffc1c61e, c2494d2156bc6766, efe75238c622efbb, 35a2d511a21a4263), Crewing ×1 (e6149f9b2aab29ce), Incident ×4 (3201171579f45af8, ceb3e31b6e6ed8a7, 525ce802dbcca23b, 5cd0d392035a3206), Safety ×7 (ab160ffe1a14e733, a10cd79a2fa57c7e, 16a8d99022a9e81b, 70475a998cebbc6f, a3e1ab92590df9f7, 182b93c99791a6c1, 2fbae044792f5796), Technical ×4 (c4c026beb21bcc99, 996227bf0fffbb43, ef0e35d1df7f09c5, c9359810897950e7) |
| **B** + corrected code-derived docs | `kb-base` (911, 25 documents) = the live index's chunk ids | A + `Technical - Bulk Data Import (Operational) User Manual.docx` bffa8828d516ab84 (9 chunks), `Technical - Recent Updates & Changed Behaviours (Operational) Notes.docx` d10f3027834959ef (13; the R3.1 text — the R3.2 file on disk, 71bafc19d9546d43, is the superseded variant and is NOT in any tested set), `Technical - Roles & Permissions (Operational) User Manual.docx` e845a51f00a291ce (13), `Technical - Ship-Side (Vessel Crew) Operational Notes.docx` 0bb3e4225ed74fda (8), `Technical - Sync (Operational) User Manual.docx` 25f4a49ef951ccee (13) | |
| **C** + KB pilot files | `kb-pilot-c` (916, 30 documents) | B + `kb/technical/work-orders/` (`--kb-dir --kb-provenance-line`), 911 vectors reused, 5 embedded | `how-work-orders-are-created.md` 13bb400152f72416, `office-generate-now.md` 08021956687fb79c, `office-generate-wo-per-job.md` 579102df9334c878, `planned-wo-ship-daily-scan.md` 1b5fb1ed055941f0, `unplanned-wo.md` 939dec7535dea707 — one chunk each (1,996–2,375 chars) with the provenance note inserted after the title line (a first attempt put the note above the title and the chunker split each file into two chunks; rebuilt) |

Build key of every manual chunk (all sets): `…|clean=off|xrefs=2026-09-14.4|repairs=2026-09-14.1|chunker=2026-03-17.original|1200/150|embed=llamaindex-meta9|model=text-embedding-3-large:3072`. Candidate containers: `sail-assistant-py-abc-a` 8021 (A), `-abc-b` 8022 (B), `-abc-c` 8023 (C), image `sail-assistant-py:prompt-v5` 8b1d2ddfb910, the dedicated key, capture enabled per container (request bodies to `/app/out/capture.jsonl`). Suites run from the bridge network (`run-abc-suites.sh` → `abc-runs.txt`, `abc-*-dump.jsonl`).

Module context, established for step 4 (PROVEN from `client/src/hooks/useChat.ts:71-76`): the Technical widget always sends `context.module: "technical"` plus `vesselId`, `vesselName` and `currentPage` (the browser path). So the context is the ORIGINATING module, never the topic of the question; a Safety question asked from the Technical screen arrives with `module: technical`. The docs path today ignores `context.module` for routing (`app/chat.py:97`, `retrieval.route`); it is used only to pick the tool-loop manifest.

### 14.3 Step 2 results — what Luna answers from the manuals alone, and what each addition contributes (`abc-runs.txt`, `abc-*-dump.jsonl`, captures `abc-{a,b,c}-capture.jsonl`)

Judges used for the scores below: frozen suite .4 (markdown normalisation, cases unchanged — §14.4), corrected-claims judge with the same normalisation, work-order judge .11 (§14.4), retrieval expectations v1/v2. Every run also read by hand where a verdict is discussed.

| suite | A manuals only (855) | B + corrected code-derived docs (911) | C + KB files with provenance note (916) |
|---|---|---|---|
| retrieval 18 | **16/18** — the two misses are the queries whose expected source IS a code-derived doc ("why did the running hours not go down…" → Ship-Side notes; "how do vessels sync…" → Sync notes); absent from A by construction, not a ranking fault | 18/18 | 18/18 |
| frozen 12, joint of 3 runs | 11/12 | 11/12 | 11/12 — identical case by case; 05 → clarify gate on all three |
| corrected claims 14 | cases 2 and 9 (the only two whose evidence is in an official manual) **pass 3/3**; 11 cases × 3 runs = 33 runs say honestly that the excerpts do not cover it; case 12 ×3 answered from the PMS manual's Sync Dashboard section (manual sync + automatic sync) — faithful to A's sources, the re-provisioning claim exists only in the code-derived docs | 11/14 (case 1 fails the literal "generated" 3/3 — answers say "the system generates a code"; case 4 known test-string defect; 7 and 13 one run each) | 11/14 (same two literal/known failures; 13 one run) |
| work-order 8 phrasings, all runs required | **0/8** — every answer gives only the manuals' unplanned procedure (Office and Ship), 1 run adds "the excerpts do not describe other methods" | 0/8 — the corrected docs' work-order section is not retrieved for these phrasings | **6/8** — wo-generic-03 (overview outside the top 8) and wo-phr-02 (pump: no overview in the excerpts; 2/3 runs assume unplanned) |

What this establishes:
- From the official manuals alone, Luna + v5 answers every frozen case the richer sets answer (11/12, same case set), and states an honest limitation when the evidence is absent (33 of 36 runs on code-derived-only claims; the other 3 answer faithfully from the manual's own sync section). It never fabricates a code-derived claim. Its work-order answer from the manuals is the unplanned procedure only — correct for what the manuals say, incomplete for the product.
- The five corrected code-derived documents add exactly the code-derived claims (corrected suite 2 → 11 of 14) and the two retrieval expectations; they change nothing on the frozen suite and nothing on the work-order phrasings.
- The five KB files add the work-order coverage (0/8 → 6/8) with the provenance note now inside each chunk (the model repeats it: "The automatic-generation and office-switch details come from draft code-derived guidance"); frozen and corrected results unchanged against B.
- The remaining two work-order misses are retrieval: the overview is not among the five excerpts for "How to create work order in PMS?" (outside the top 8) and for the pump phrasing (rank 8) — step 4.

### 14.4 Step 3 (part 1) — judge corrections proven on stored answers, old results preserved

| judge | change (parsing only; no expectation changed) | validated on | verdicts changed |
|---|---|---|---|
| base judge (frozen / corrected / manual suites) `.4` | markdown emphasis stripped before phrase matching — Luna writes "the **Operation** tab", which the literal check read as "operation** tab" | 8 stored dumps, 336 runs (`judge-base4-validation.txt`) | 9 runs, all corrected case 9 (Me / My Team toggle), False → True: A-manuals 3, B 3, C 2, earlier luna 1; no other run moved |
| work-order judge `.10` | negation window 90 chars and trailing negation | all stored WO answers | 1 (C wo-phr-04 run 2, false "unplanned requires the switch") |
| work-order judge `.11` | a switch/role mention inside the unplanned scope counts as a requirement only when its sentence carries requirement wording and no negation — the v5 source-comparison sentence ("the office-switch details come from draft code-derived guidance") was read as a condition | all stored WO answers, 243 runs (`judge11-validation.txt`) | 3 verdicts (C wo-phr-03 r2, wo-phr-04 r2, wo-phr-05 r3 → PASS); 8 more rule notes dropped on already-failing unplanned-only answers ("Office / Sail Admin" heading labels are no longer read as a role requirement) |

### 14.5 Step 3 (part 2) — manual-coverage suite on the three sets (`abc-manuals-runs.txt`, `abc-manuals-dump.jsonl`, captures `abcm-{a,b,c}-capture.jsonl`)

Suite `acceptance_manuals.py` 2026-09-15.1, 57 source-backed cases over all 20 official manuals (procedure 12 · condition 20 · table 8 · screenshot 7 · cross-reference 10), authored from the manuals-only chunk text with every must phrase and page verified against that text before use (`manual_cases.json`); 3 runs per set; the request bodies of every run captured per container. Automatic score = base judge (manual + accepted pages + must/must_not, markdown-normalised) ∧ support (the must phrases present in the cited/supplied excerpt text of that very run).

| set | cases passing all 3 runs | runs pass | runs: answer-phrase fail, citation ok | runs: answer ok, cited page/manual ≠ expected | runs: both | runs: said "not covered" although the manual holds it |
|---|---|---|---|---|---|---|
| A manuals only | 22/57 | 78/171 | 37 | 32 | 11 | 13 |
| B + corrected docs | 20/57 | 80/171 | 36 | 36 | 12 | 7 |
| C + KB files | 24/57 | 82/171 | 36 | 35 | 13 | 5 |

Sources used (from citations and captured excerpts): A 165/171 runs manual-only (6 no citation); B 162 manual, 6 code-derived + manual, 3 none; C 162 manual, 3 code-derived + manual, 3 KB + manual, 3 none — the additional sources are used in ≤ 6 of 171 runs and only alongside a manual. Per kind (runs passing, A): procedure 25/36 · table 12/24 · condition 24/60 · screenshot 9/21 · cross-reference 8/30.

The automatic score is a floor, not a verdict: 32–36 runs per set have a correct-looking answer whose top citation is a neighbouring page or the other Office/Vessel variant, and 36–37 fail a literal must phrase. Every failing case (35 on A, 33 on C) is being read against the manual text with a six-way classification (correct paraphrase · correct but adjacent page · partial · wrong · honest limit · wrong source); the classification and the resulting true-defect list are in §14.5a when complete.

### 14.5a Step 3 (part 3) — every failing manual-suite case read against the manual text (`review-A-classification.json`, `review-C-classification.json`; packs `review-pack-*.json`)

Method: for each case the automatic judge failed, the first failing run's full answer, its citations and the case's verbatim evidence were compared, and where the citation differed from the expected page the cited page's own text was checked in the chunk dump. Six labels; the reading was done independently for set A (manuals only) and set C (the full package); set B's failures are the same cases as A's.

| label | A manuals only (35 failing cases) | C full package (33 failing cases) |
|---|---|---|
| correct paraphrase — same facts, right manual; the judge failed a literal phrase, tense, word order or "WO"/"work order" | 28 | 30 |
| correct, cited page adjacent to the expected one (cited page checked) | 1 (ra-office-2: hazard tabs right, Source line cites p.12/p.19) | 1 (prep-3: attachment facts on p.19/p.21) |
| partial — a step or the comparator missing | 2 (certsurveys-1: the auto-generated Master ID; pmsoffice-5: compared against the Reports filter instead of the vessel Dashboard filter §1.1.3.2 p.9) | 0 |
| honest limit although the manual holds it | 4 — hist-1 and pmsoffice-1: the clarify gate fired (routing), no excerpts; pmsvessel-1: right page, the chunk defining "Stores" not among the five (retrieval); certsurveys-3: both sections and the pointer text were in the excerpts, the model still said no resolved cross-reference exists (model) | 1 — pmsoffice-1 (clarify gate) |
| wrong source | 0 | 1 — hist-1: the Audit History "Review section" question answered from the PMS Office work-order review text (wrong module) |
| wrong statement | **0** | **0** |
| **correct by reading, out of 57** | **51** (22 automatic + 29) | **55** (24 automatic + 31) |

Source distinction on C: the three runs that cite a KB pilot file label it "draft code-derived guidance" separately from the manuals (pmsvessel-4), accurately. No answer in either set states something the manual does not say. The real defects are five on A (two routing, one retrieval, one model, two partial) and two on C (one routing, one wrong-module routing); the two routing misses are the same two questions on both sets and both are the clarify gate or a module miss that step 4 addresses (the Due/Overdue question arrives with technical context; the Audit History question names no manual term the intent router recognises — "history" is filtered as generic — so it stays a known miss).

Judge notes from the reading (reported, not changed): literal substring matching undercounts correct paraphrases; a `must_not` phrase fires inside a negation ("Do not create a new approver record", ra-office-1); the citation check reads the structured citations, not the answer's own "Source:" line (fs-off-2, prep-1, moc-office-2 name the expected page in prose); the "said not covered" flag catches hedges such as "does not describe" on full answers.

### 14.6 Step 4 — intent and routing (`s4-routing*.txt`, `s4-routing-r*-dump.jsonl`, `probe2.py`)

How the assistant identified the module before this step (READ, `app/chat.py`, `app/retrieval.py`): one embedding of the question; the ten nearest chunks; per-module best distance; if the best two modules are within 0.07 → `clarify`; otherwise the top module's chunks (≤ 5) are the excerpts. `context.module` was not used on the docs path at all. Nothing recognised a named method or an action; "create a work order" simply landed on the nearest chunk, the manual's unplanned section.

Bounded approach implemented behind two flags (both default off = served behaviour; image `sail-assistant-py:prompt-v5-r5`; thresholds, excerpt count, prompt unchanged):
- `ASSISTANT_ROUTE_INTENT=on` — the question's own words decide the module when they name it: an explicit module name/alias ("Safety module", "PMS") or a manual/sub-module name derived from the served corpus's document titles ("risk assessment", "near miss", "master review", "bulk data import", …; single generic words such as "history" or "sync" are excluded; a term that maps to two modules is dropped). An explicit module name beats a manual name; a named module overrides vector routing and cancels `clarify`. The originating module (`context.module`) only breaks a clarify tie when it is one of the near candidates. Identity, tenant and vessel checks are untouched (routing only). The response now carries `routing` = the reason.
- `ASSISTANT_HYBRID=on` — excerpt selection inside the routed module fuses the vector ranking with a lexical ranking over the existing `tsv` column (OR of the question's content words; contents pages excluded; a chunk's own heading weighted as well as its body), score = 0.5·(1 − distance/floor) + 0.5·(lexical/max). Four revisions were measured on the routing probes before this one (below).

Routing probes (`acceptance_routing.py` 2026-09-15.2, `routeOnly` — embeddings only, no answer model; 13 cases incl. frozen case 05 with technical / no / safety context and with a conflicting explicit "Incident module", the three work-order intents, and the guard that context never overrides an explicit name). Measured separately: C0 = flags off, D1 = routing only, D2 = routing + excerpt selection, same image, same index `kb-pilot-c`, same query embeddings per probe:

| image revision | change | C0 | D1 | D2 |
|---|---|---|---|---|
| r1/r2 | RRF fusion of vector and lexical ranks; lexical = AND of all words (r1) → OR of content words (r2) | 8/13 | 11/13 | 12/13 |
| r3 | contents pages excluded from the lexical side | 8 | 11 | 12 |
| r4 | chunk heading weighted in the lexical score | 8 | 11 | 12 — the overview now leads the LEXICAL ranking for "How to create work order in PMS?" (score 3.7) but RRF cannot surface a chunk that leads one ranking and is absent from the other |
| **r5** | convex score fusion instead of RRF | 8 | 11 | **13/13** |

What each part does (D1 vs C0 = routing; D2 vs D1 = excerpt selection): case 05 "What are the hazard categories in a risk assessment?" — `clarify` (margin 0.010) with technical context, without context and with safety context on C0; on D1/D2 it routes to Safety by the manual name and the five excerpts are the Risk Assessment manuals in all three context variants; "In the Incident module, what are the hazard categories in a risk assessment?" → Incident on D1/D2 (explicit module wins, honest "not in Incident documentation" expected at answer level); "How do I report a near miss?" with technical context → Incident on all (context does not override). Excerpt selection: "How to create work order in PMS?" gets the overview only on D2-r5 (first excerpt), the pump phrasing gets it on D2 from r2 on (third excerpt at r5); a named method keeps its own procedure (unplanned, Generate Now, Generate WO cases pass on all three).

Retrieval-18 on the three (top-1 source check, expectations v1/v2): C0 18/18 · D1 18/18 · **D2 16/18** — two top-1 changes, both reorderings within the five excerpts, not losses: "how do I create a work order" now leads with the KB overview (then the two manual unplanned sections, the KB unplanned and planned files — the two "complete the work order" sections dropped out); "why did the running hours not go down…" now leads with the Ship-Side notes §1.1.13.2 (the Recent Updates §1.1.14.2/§1.1.14.3 chunks stay at positions 3–4). The suite's expectations predate the KB files; a v3 expectation for the first query would name the overview — reported, not changed. Answer-level effect measured in §14.7.

### 14.7 Step 5 — routing and excerpt selection measured separately at answer level

> **CORRECTED — see §15.1** (18-Sep). The numbers below are kept as the historical record. Three corrections apply: the frozen and corrected suites score by MAJORITY of three runs, not all three; the C0 column's frozen/corrected/manual cells were not run on C0 but on set C (image `prompt-v5`); and the routing figure combines module selection with expected-source presence, which §15.1 separates.
 (`s4-runs.txt`, `s4b-runs.txt`, `s4-*-dump.jsonl`, `s4b-*-dump.jsonl`, captures `s4-{c0,d1,d2,d3}-capture.jsonl`, `lexdiag3.txt`, `selectdiag.txt/.json`, `s4-manuals-rejudge-D2.txt`, `usage.py`)

Four containers, one image (`sail-assistant-py:prompt-v5-r5` fd97292862b4), one index (`kb-pilot-c` 916), one model and prompt (gpt-5.6-luna, default temperature, v5 `ff9ee87141ac1362`), the dedicated key; only the two flags differ. Each step is compared with the preceding candidate. All answer suites ×3, all runs required.

| suite | C0 flags off | D1 routing only | D2 routing + fusion α 0.5 | D3 routing + fusion α 0.7 |
|---|---|---|---|---|
| routing probes 13 (`routeOnly`) | 8 | 11 | 13 | 13 |
| retrieval 18 (top-1) | 18 | 18 | 16 | 16 |
| frozen 12 ×3 | 11 (05 → clarify) | **11** (05 answered 3/3, hazard list complete; only the top citation's page differs from the two figure pages — judge) | 8 (01/03/10: answer right, top citation moved to another page of the same manual or the Office/Vessel twin; **06: the Near Miss icon-table chunk was no longer among the five — the answer says the trash icon's function "is not described"**) | 9 (03/06/10 as D2) |
| corrected 14 ×3 | 11 (§14.3 C) | (run with D4, §14.7a) | 10 (gen-01 literal "generated" 0/3 as before; gen-04/06/14 answer right, top citation moved from the corrected doc to a KB pilot file that states the same; gen-13 2/3) | — |
| work-order 8 ×3 (judge .11) | 6 | 5 (same excerpts as C0; phr-04 2/3 and phr-02 1/3 vs 3/3 and 0/3 — run-to-run variance at default temperature) | **8** (generic-03 and the pump phrasing now get the overview: first excerpt) | 5 (generic-01 2/3, phr-01 2/3, phr-04 1/3) |
| manual-coverage 57 ×3 (with support from the captured excerpts) | 24 (§14.5, set C) | (run with D4, §14.7a) | **16** — 18 runs on 6 cases (fs-ves-1, hist-1, prep-3, inc-2, master-review-2, sms-office-1) had the must phrases in none of the supplied excerpts, against 9 runs on 3 cases for C | — |
| tokens per answer in / out · latency mean / p95 (3–4 candidates answering concurrently) | 2,076 / 757 · 11.4 s / 14.8 s (work-order answers only) | 1,788 / 491 · 7.3 s / 13.1 s | 1,783 / 306 · 5.3 s / 12.1 s | 2,055 / 535 · 7.2 s / 11.8 s |

Attribution. Routing alone (D1 vs C0): +3 routing probes (case 05 in all three context variants), frozen 05 answered instead of clarified, no loss on retrieval or frozen; the work-order difference is variance on identical excerpts (the routing reason is "vector routing" on all eight phrasings except "…in PMS?", and that one gets the same five). Excerpt selection r5 (D2 vs D1): +2 probes and +3 work-order cases (the two known misses and the run-variance case), but −3 frozen (one real: 06), 2 retrieval top-1 reorderings, 3 corrected top citations moved from the corrected documents to KB pilot files, and manual coverage 24 → 16 with twice the retrieval-level gaps. α 0.7 (D3) keeps the losses and gives back the work-order gains — dropped.

Why the fusion loses chunks (`lexdiag3.txt`, embeddings only, D2 container): (i) a chunk outside the lexical top-10 is scored as lexical 0 — the Near Miss p.5 icon-table chunk (distance 0.751, vector rank 2) was displaced by the Fleet Notification "3. Actions" p.8 chunk (distance 0.981, lexical 2.6, one word in common with the question); (ii) the two sides are not on one scale: 1 − distance/floor is ≤ 0.4 for every real hit while lexical/max reaches 1.0, so at "α 0.5" the lexical side decides — chunks dense in the question's words (the KB pilot files for anything with "work order", "office", "generate") displace nearer manual and corrected-document chunks (gen-14: the Recent Updates "Running Hours Is a Per-Vessel Switch" chunk, distance 0.88, lost to two KB files at distance 1.07). Raising α does not cure (i).

Variant comparison before any further answer-model call (`selectdiag.py`, 104 suite questions, embeddings only, same index; the offline harness's module choice was vector routing because `route()` reads the flag itself, so the four rt-05 probes and frozen 05 sit at `clarify` in every column and are excluded from the comparison — every other question routed as in D1). Columns: V0 = the served five · r5 = D2's fusion · VA = fusion with the lexical score of every matching chunk (no top-10 truncation) · VB = the served five with the lexical leader put in the last slot when absent · VC = VA with both sides min-max normalised.

| expected source among the five | n | V0 | r5 | VA | VB | VC |
|---|---|---|---|---|---|---|
| routing probes (work-order ones) | 13 | 7 | 9 | 9 | 9 | 9 |
| work-order (overview / planned file present) | 8 | 5 | 8 | 8 | 7 (generic-02: overview present, planned file not — answered 3/3 on C0/D1 from the overview) | 8 |
| frozen (expected manual + page) | 12 | 11 | 11 | 11 | 11 | 11 |
| corrected (expected document) | 14 | 14 | 14 | 14 | 14 | 14 |
| manual-coverage (expected manual + page) | 57 | 53 | 50 | 49 | 52 | 52 |
| served excerpts kept, manual questions | 258 | 258 | 161 | 167 | **244** | 194 |

VB keeps 95 % of the served excerpts, supplies the overview for both work-order misses (fifth excerpt) and loses one manual case at retrieval level (master-review-2: the p.11 Part E chunk was the fifth vector hit and gives way to the lexical leader p.6). It changes one slot, no threshold, no count, no prompt, and does not prefer any source type — the slot goes to whichever chunk leads the lexical ranking. Adopted as **r6 = `ASSISTANT_HYBRID=rescue`** (`retrieval.lexical_rescue`; r5 kept as `on` for reproducibility), image `sail-assistant-py:prompt-v5-r6` 58d02521e6ae, container `sail-assistant-py-s4-d4` :8028 (routing on, rescue, kb-pilot-c, capture bind-mounted). Measured against D1 in §14.7a.

### 14.7a r6 (D4) against D1 — same model, prompt, key, index; only excerpt selection differs

> **CORRECTED — see §15.1** (18-Sep). The six manual-coverage losses are five run-to-run variations plus one selection change (pmsoffice-5). The seventh item named below, master-review-2, is a retrieval-level regression that does NOT change the score because the case already failed on D1. The pass rules per suite are as stated in §15.1.
 (`s4c-runs.txt`, `s4c-*-dump.jsonl`, `s4-d1-capture.jsonl`, `s4-d4-capture.jsonl`, `s4c-manuals-rejudge.txt`)

| suite (×3, all runs required) | D1 routing only | D4 routing + rescue (r6) | reading of every difference |
|---|---|---|---|
| routing probes 13 | 11 | **13** | "How to create work order in PMS?" and the pump phrasing now carry the overview as the fifth excerpt |
| retrieval 18 (top-1, v1 = v2) | 18 | **18** | the two D2 reorderings are gone — the vector order is kept |
| frozen 12 | 11 | 11 | both fail only 05: hazard list complete 3/3 on each, the top citation is the Office manual's "Method 1: Add Hazards from Database" chunk (judge reads its page as 19; the case accepts 13/12, the figure pages both manuals name in the answer's own Source line) — judge, not answer. Case 06 (the D2 loss) 3/3 on D4 |
| corrected 14 | 12 | 12 | identical failures: gen-01 literal "generated" (answers say "generates"), gen-04 expected-substring defect ("(Operational)" is not in the Ship-Side file name); gen-13 2/3 on D4 (one run's wording) |
| work-order 8 (judge .11) | 5 (by reading 6: generic-03 and the pump phrasing have no overview) | **7** — by reading **8**: generic-03 run 1 states "A Sail Admin signs in … click Generate Now" under the heading "Planned work order generated from the Office"; the judge scopes prerequisites by a heading that names the action and finds none (judge gap, reported, judge unchanged) | +2 cases from the fifth excerpt; the D1 5/8 is the C0 variance (§14.7) |
| manual-coverage 57 (support from the captured excerpts) | 24 (= set C; the same 3 retrieval-level cases hist-1, prep-3, sms-office-1) | 18 | 15 of 57 questions get a different fifth excerpt on D4. Exactly one loses the expected chunk: master-review-2 (p.11 Part E → p.6; D1 also failed it automatically — right answer, top citation p.7). Of the other six cases D4 lost: **five have byte-identical excerpts on D1 and D4** (inc-3, crewing-1, moc-office-1, safety-meeting-1, pmsvessel-2 — one or two runs of three fail a literal phrase or hedge) = run-to-run variance; pmsoffice-5 (2/3) had its fifth excerpt swapped (PMS p.38 filter → Cert. & Surveys p.10 filter) — ambiguous. Variance band on this suite at all-runs-required: D1 has four cases at 2/3 on the same inputs that C or D4 pass; D4 eight |
| actual usage per answer (in / out) · cost per 1,000 answers · latency mean / median / p95 (two candidates answering concurrently) | 1,440 / 239 · $0.57 · 4.2 s / 3.9 s / 7.9 s (213 answers) | 1,554 / 301 · $0.67 · 4.7 s / 4.3 s / 9.4 s (273 answers) | r6 adds ~110 input tokens per answer (the rescued excerpt) |

What r6 changes, measured: the two work-order intents the brief names (general creation → overview and alternatives; the pump question is no longer an unplanned-only instruction: "You can raise a pump work order in three supported ways…" 3/3), nothing on retrieval-18, frozen or corrected, and one manual case at retrieval level. What it does not change: hist-1 (Audit History question routed to Technical — no manual term the router recognises), pmsoffice-1 (clarify), prep-3 and sms-office-1 (the must phrases are in no supplied excerpt on any set), certsurveys-3 (model reasoning, §14.5a).

### 14.8 Step 6 — the final candidate package, verified as one unit

> **CORRECTED — see §15.1** (18-Sep). "×3, all runs required" is true only of the work-order and manual-coverage suites; frozen and corrected score by majority of three. Under all-runs, D4 frozen is 10/12 and corrected 11/14. Neither D1 nor D4 is approved for deployment.
 (nothing deployed; live, nginx, SMS RAG, shared keys untouched)

Recommended package = D4. The alternative D1 (routing only, no excerpt change) is fully measured in the same tables should the owner prefer to keep the served excerpt selection.

| item | value |
|---|---|
| image | `sail-assistant-py:prompt-v5-r6` **58d02521e6ae** (server build of this branch's `app/` at this commit; Dockerfile unchanged; runs as uid 10001) |
| answer model / sampling | `CHAT_MODEL=gpt-5.6-luna`, `CHAT_TEMPERATURE=default` (no temperature sent — the model accepts only its default); `/health` reports both |
| embedding model | `text-embedding-3-large` (3072 dims), one call per question |
| key | the dedicated assistant key (`~/central-assistant/assistant-luna.env`, mode 600; scoped to the two models above; never printed) |
| prompt | `v5-plain-coverage-2026-09-15` — docs sha `ff9ee87141ac1362`, tool-loop sha `7a028346c1c2fdf0`, combined `aea94e2f5edb6948` (from `/health`) |
| retrieval settings | floor 1.15 · margin 0.07 · top_k 10 · answer_chunks 5 (unchanged since Chroma); `ASSISTANT_ROUTE_INTENT=on`; `ASSISTANT_HYBRID=rescue`; masking on; identity/tenant/vessel checks untouched (routing and excerpt selection only; the tool-loop path is not affected) |
| index identity | `kb-pilot-c`: 916 chunks, 30 documents = 855 manual chunks (20 official PDFs, sha256 prefixes in §14.2; parses reused, 0 embedding calls) + 56 chunks of the five corrected code-derived `.docx` (hashes §14.2) + 5 one-chunk KB pilot files with the provenance line after the title (hashes §14.2); build key `…|clean=off|xrefs=2026-09-14.4|repairs=2026-09-14.1|chunker=2026-03-17.original|1200/150|embed=llamaindex-meta9|model=text-embedding-3-large:3072` |
| suites on this exact package (×3, all runs required) | routing 13/13 · retrieval 18/18 (v1 and v2) · frozen 11/12 automatic, 12/12 by reading (05 judge page) · corrected 12/14 automatic, 13/14 by reading (gen-01 literal; gen-04 test-string defect) · work-order 7/8 automatic, 8/8 by reading (generic-03 run 1 judge scope) · manual-coverage 18/57 automatic with support — the differences from D1's 24 are one retrieval-level loss (master-review-2), one ambiguous (pmsoffice-5) and five variance cases on identical inputs; the 57 cases were not re-read one by one for D4 (the C reading in §14.5a stands for the unchanged excerpts: 42 of 57 questions get the same five) |
| individual failures | frozen 05 (judge page) · corrected gen-01, gen-04 (judge) · work-order generic-03 r1 (judge) · manual: hist-1 (routing), pmsoffice-1 (clarify), prep-3 + sms-office-1 (chunk gaps on all sets), master-review-2 (r6 fifth slot), certsurveys-3 (model), plus the literal-phrase and variance cases listed in `s4c-manuals-rejudge.txt` |
| actual token usage | D4, 273 answers: 424,371 input + 82,199 output tokens (dumps' `usage`, now populated); 1,554 / 301 per answer |
| estimated cost per 1,000 questions | **≈ $0.67** at the READ list price $0.20 / $1.20 per 1M (input $0.31 + output $0.36); embeddings add < $0.01; step 4–6 today: 903 answers over the five candidates ≈ $0.66 |
| latency | D4: mean 4.7 s, median 4.3 s, p95 9.4 s over 273 answers with two candidates served concurrently from one host (single-candidate latency not measured separately; live gpt-4o-mini was 2.5 s mean in §13.4) |
| remaining limitations | (1) a question naming only a generic word ("history", "sync") is routed by vector distance alone — hist-1 goes to Technical; (2) the clarify gate still fires for pmsoffice-1 (Due/Overdue, technical context, margin < 0.07 between Technical manuals — context breaks a tie only when the originating module is a candidate, which it is not here); (3) two manual pages whose sentence is not in any served chunk (prep-3 attachment actions, sms-office-1 §4.1.2); (4) r6 costs master-review-2; (5) answers vary run to run at default temperature — automatic totals on ×3 carry a band of about ±4–8 cases on the 57-case suite; (6) judge gaps reported, not changed: heading-scoped prerequisites (WO), literal must phrases and `must_not` inside negation (manual suite), the page read from a "(p.N)" section label (frozen 05); (7) the response now carries a `routing` field (additive; the widget ignores it) |

## 15. Owner brief of 18-Sep — reliability of the final candidate (candidate only; D1 and D4 both unapproved)

### 15.1 Step 1 — reconciliation of §14.7/§14.7a/§14.8 against the stored runs (`reconcile.py` → `reconcile.txt`; no service or model calls)

Everything below is recomputed from the saved dumps and captures. Where a published figure was wrong or ambiguous, the original wording is kept in §14 and corrected here; the corrected figures are authoritative from now on.

**Correction 1 — the suites do not all use the same pass rule (this is the single biggest cause of confusion in §14).** The work-order and manual-coverage suites require **all three runs** to pass. The frozen and corrected-claims suites take the **majority of three** (`sum(votes)*2 > len(votes)`), so a case that passes 2 of 3 counts as a pass. §14.7, §14.7a and §14.8 labelled every suite "×3, all runs required". That label was wrong for two of the four suites. Both rules are now reported.

| suite (image r5 unless noted) | rule | C-kbpilot (no flags, image prompt-v5) | C0 flags off (r5) | D1 routing | D2 fusion α0.5 | D3 fusion α0.7 | D4 rescue (r6) |
|---|---|---|---|---|---|---|---|
| work-order 8 | all runs | 6/8 (rejudged .11) | 6/8 | **5/8** | 8/8 | 5/8 | 7/8 |
| frozen 12 | majority (suite's own) | 11/12 | not run | 11/12 | 8/12 | 9/12 | 11/12 |
| frozen 12 | all runs | 9/12 | not run | 10/12 | 8/12 | 9/12 | 10/12 |
| corrected 14 | majority (suite's own) | 11/14 | not run | 12/14 | 10/14 | — | 12/14 |
| corrected 14 | all runs | 10/14 | not run | 12/14 | 9/14 | — | 11/14 |
| manual coverage 57 | all runs | 24/57 | not run | 24/57 | 16/57 | — | 18/57 |

**Correction 2 — three published C0 cells were never measured on C0.** C0 (flags off on image r5) has stored runs for the work-order suite and the routing probes only. The frozen, corrected and manual-coverage cells printed in the §14.7 "C0 flags off" column came from set C (`abc-c`, image `prompt-v5`, same index `kb-pilot-c`, before the flags existed). Same index and same model, different image. Relabelled above.

**Correction 3 — the set-C work-order column mixes judge versions.** The stored set-C verdicts were written by the judge of the day; §14.3 quoted 6/8 after re-judging with .11. Re-judging the stored answers with .11 (`rejudge_wo.py … --from 11`) confirms **6/8** and changes nothing else, so the C column above is comparable with C0/D1/D4.

#### Why D1 work-order falls from 6/8 to 5/8 although routing "costs nothing"

The single lost case is **wo-phr-04** ("Steps to create a new work order"). The excerpt lists on C0 and D1 are **byte-identical** (same five, same order), and the routing reason is "vector routing" on both. Runs 1 and 2 pass on D1; run 3 produces a different answer that the judge fails. So this is **run-to-run variation of the answer model at default temperature, not a routing effect** — and because the work-order suite requires all three runs, one varying run drops a whole case. The same mechanism works in the other direction on D4, where the identical excerpts give 3/3.

Comparing inputs rather than scores: on 8 of 8 work-order cases the five excerpts are identical between C0 and D1. Routing changed only the *reason* recorded for wo-generic-03 ("explicit: module name in question", from the word PMS) while selecting the same module and the same excerpts. **Routing changes no work-order input at all; the 6→5 difference is noise.** The honest statement is therefore: routing is input-neutral on this suite, and the suite cannot resolve a one-case difference at ×3.

#### Which frozen case fails when case 05 improves

**Case 05 itself is still the failing case**, on C, D1 and D4 alike. Routing fixed the *gate*: with flags off the question returns a clarification in all three runs (no answer, no citations); with routing on it answers from the Risk Assessment manual and lists all six hazard categories in all three runs. The case still fails because the **top citation is the "Method 1: Add Hazards from Database" chunk**, whose page label is not one of the accepted pages (12, 13). D2 and D3 pass the case only because the score fusion happens to put the "How to fill Vessel Risk Assessment form" chunk (page 12) first. So:
- under the majority rule the frozen total is 11/12 for C, D1 and D4, and the one failing case is 05 in each;
- under the all-runs rule the total is 9/12 for C and 10/12 for D1 and D4, because **case 08** (Crewing waitlist export) passes only 2 of 3 runs on those three candidates;
- the improvement at case 05 is real but invisible in the total, because the case moves from "clarification, nothing cited" to "correct answer, wrong page cited" — both score zero.

#### The manual-coverage loss count (the published "six losses" versus the seven items listed)

Recomputed from the dumps: **D1 → D4 is 6 losses and 0 gains** — inc-3, crewing-1, pmsoffice-5, pmsvessel-2, moc-office-1, safety-meeting-1. Their composition:

| case | excerpts D1 vs D4 | what changed | class |
|---|---|---|---|
| inc-3 | identical | run 3 wording only | run-to-run variation |
| crewing-1 | identical | run 1 omits a required phrase | run-to-run variation |
| pmsvessel-2 | identical | runs 1–2 omit a required phrase | run-to-run variation |
| moc-office-1 | identical | run 2 wording only | run-to-run variation |
| safety-meeting-1 | identical | run 2 wording only | run-to-run variation |
| pmsoffice-5 | **fifth excerpt swapped** (PMS p.38 filter → Cert. & Surveys p.10 filter) | 1 of 3 runs fails | selection change, effect ambiguous |

So the correct arithmetic is **five run-to-run variations plus one selection change**. The seventh item in the §14.7a text, **master-review-2**, is a genuine retrieval-level regression from the rescued slot (the page-11 Part E chunk leaves the five) but it is **not** one of the six losses: the case already failed on C, D1 and D2 for other reasons, so it cannot fall further. §14.7a mixed a score loss with a retrieval loss and so appeared to list seven items for six. Both facts stand; the classification does not.

#### Routing-13: module selection and source presence are two different measurements

The suite has 13 checks. All 13 assert the module (or the gate, for the conflicting-module case); **12 of them additionally assert that a named source is among the five excerpts**. The published single number combined both. Split, from the stored responses:

| measurement | C0 flags off | D1 routing | D2 fusion | D3 fusion | D4 rescue |
|---|---|---|---|---|---|
| module selected correctly (13 checks) | 10/13 | **13/13** | 13/13 | 13/13 | 13/13 |
| expected source among the five (12 checks) | 7/12 | 10/12 | 12/12 | 12/12 | **12/12** |
| published joint number | 8/13 | 11/13 | 13/13 | 13/13 | 13/13 |

Reading: **routing alone fixes module selection** — the three failures on C0 are the three variants of frozen case 05, which returned a clarification instead of choosing Safety. Routing also carries those three cases' sources with it (7 → 10), because once the module is right the Risk Assessment chunks are the only candidates. The remaining two source failures, `rt-general-02` ("How to create work order in PMS?") and `rt-pump-01`, are **excerpt-selection** failures that routing does not touch and that only the selection change fixes (10 → 12). The two effects must not be added together as "routing improved 8 → 13".

### 15.1a Reviewer's four follow-up points on the reconciliation (18-Sep), answered from stored evidence

**(1) "Variation" is not a synonym for "harmless".** Accepted as a rule for step 2: identical excerpts rule out a *retrieval* change, they do not excuse a wrong or incomplete answer. Every run in §15.2 is therefore judged on its own text, and each missing required phrase is classified as either a correct paraphrase or a genuinely missing instruction, prerequisite or applicability statement.

**(2) Case 05's citation failure is a judge defect — now fully diagnosed (`s4c-answers-dump.jsonl`, `s4-d4-capture.jsonl`).** The reviewer was right that a wrong *first* retrieval result does not prove the answer cites the wrong page. For D4 run 1 (runs 2 and 3 identical in the respects that matter):

| what | value |
|---|---|
| citations shown to the user | [1] Office manual "Method 1: Add Hazards from Database (p.19)" · [2] Office "6.4 Completing Office RA – Part B (p.12)" · [3] Office "Document (p.13)" · [4] Vessel "8. How to fill Vessel RA form – Part B (p.12)" · [5] Vessel same section (p.12) |
| expected by the case | Office p.13 **or** Vessel p.12 |
| excerpts containing all six category names | excerpt [3] (Office p.13) and excerpt [4] (Vessel p.12) — both were supplied |
| the answer's own Source line | "Office … Figure 15, **p.13**" and "Vessel … Section 8, Figure 14, **p.12**" — both correct |
| judge behaviour | `acceptance_answers.judge` reads `citations[0]` only; it never inspects positions 2–5 or the answer's Source line |

So the answer lists all six categories, is supported by two of the five supplied excerpts, and cites the correct pages both in the structured citation list (positions 3 and 4) and in its own Source line. **The failure is entirely an artefact of checking only the first citation.** Recorded as a demonstrated judge defect; the fix and its validation over all stored answers are in §15.4, and the old scores are preserved.

**(3) The third failing frozen case on set C is case 11** ("In PMS, is there another way to add a component besides the components panel?"). Per-run outcomes, answer / citation / attribution:

| candidate | case 05 | case 08 | case 11 |
|---|---|---|---|
| C (no flags, image prompt-v5) | 0/3 — clarify gate in all three runs, no citations | 2/3 — run 2 answer fails | **2/3 — run 3 answer fails** |
| D1 routing | 0/3 — answers 3/3, citation fails 3/3 (see point 2) | 2/3 — run 2 answer fails | 3/3 |
| D4 rescue | 0/3 — answers 3/3, citation fails 3/3 (see point 2) | 2/3 — run 2 answer fails | 3/3 |

That closes the arithmetic: set C all-runs 9/12 = 12 − (05, 08, 11); D1 and D4 all-runs 10/12 = 12 − (05, 08).

**(4) The missing C0 cells stay "not run".** Set C is not a controlled baseline for frozen, corrected or manual coverage: same model, same index, different image. Those cells are marked "not run" in the §15.1 table and no C0 figure is quoted for them anywhere. Before any promotion, the selected candidate is to be compared against a baseline that is explicitly identified and, where the comparison matters, measured on the same image with the flags off.

**Status of the §14 tables.** §14.7, §14.7a and §14.8 keep their original numbers as a historical record and now carry a pointer to this section; every figure they state that this reconciliation changes is corrected above. Nothing in §14.1–§14.6 (steps 1–3) is affected: those sections report set A/B/C, which this reconciliation reproduces unchanged.

### 15.2 Step 2 — all 171 stored D4 answers reviewed on their own merits, twice (`review_pack_d4.py`, `review-d4-pack-full.txt`, `build_verdicts.py`, `review-d4-verdicts-full.json`)

Method. A pack was built from the stored dump plus the captured request bodies, so every run shows the question, the verified manual evidence, the citations the user sees, **every supplied excerpt in full** and the complete answer. Every run was judged on its own text; no verdict was inherited from the set-C reading or from the automatic score. Four reviewers covered one module group each, and I adjudicated every disputed or defective run myself against the untruncated excerpt.

**First pass retracted and repeated.** The first pack trimmed each excerpt to 700 characters, which made three correct answers look fabricated (prep-1 runs 1 and 3, crewing-5 run 3, master-review-1 run 3 — the disputed sentences are all present in the supplied text). The pack was regenerated untruncated and the whole review repeated. The numbers below supersede the first-pass table; the earlier counts (153 / 4 / 14) are kept here as the superseded record.

| verdict (per run) | count of 171 |
|---|---|
| correct | 105 |
| correct paraphrase of the manual | 52 |
| honest limitation, and the evidence genuinely was not supplied | 5 |
| honest limitation although the evidence WAS supplied | 1 |
| partial | 5 |
| wrong (answer built on the wrong module's text) | 3 |

| defect class | runs | cases affected |
|---|---|---|
| none | 154 | — |
| false claim that evidence is missing | 4 | certsurveys-3 r2 · pmsvessel-3 r2 · safety-meeting-1 r1, r2 |
| unsupported comparison stated as established | 1 | pmsoffice-5 r3 |
| procedural mistake | 1 | hist-3 r1 |
| retrieval defect (evidence indexed, not supplied) | 8 | master-review-2 ×3 · sms-office-1 ×3 · pmsoffice-5 r1, r2 |
| routing defect (wrong module) | 3 | hist-1 ×3 |

**49 of the 57 cases are clean in all three runs.** The per-run record for all 171 — case, run, verdict, which supplied excerpt supports the answer, citation assessment, defect class and reason, alongside the automatic verdict — is `review-d4-verdicts-full.json`.

#### The six substantive answer defects, by kind

**Procedural mistake (1 run).** hist-3 run 1: the question asks whether the attachment procedure also covers a Positive Observation or LAE finding. The answer correctly says yes, but its step 3 still reads "Enter the **Negative** observation", and it omits the Observation / Positive Finding / LAE page toggle that the supplied screenshot text describes. A user following those steps would enter the wrong record type. Runs 2 and 3 generalise the step correctly.

**Unsupported comparison (1 run).** pmsoffice-5 run 3: asserts "the vessel-side set is **not the same** as the PMS Dashboard set" by comparing the Office dashboard against the vessel **Reports** screen — a different screen — and drops the caveat that runs 1 and 2 state. The conclusion may even be true, but it is not established by the evidence supplied.

**False claims that evidence is missing (4 runs).** These are the opposite failure to fabrication: the model declines or hedges although the supplied text answers the question.
- certsurveys-3 run 2 — says the manual "does not establish whether the survey process is identical or different"; the supplied p.11 note says "refer to the Certificates sub-sub-module **for the add or view attachment** and follow the same steps", which is exactly the operation asked about.
- pmsvessel-3 run 2 — quotes the "refer to Spares and follow the same steps" direction, then contradicts itself with "the excerpts do not fully document whether the Stores form operates identically".
- safety-meeting-1 runs 1 and 2 — close with "the provided excerpts do not include the detailed Monthly Safety Meeting instructions" although supplied excerpt [4] (Part B, p.11) contains them; run 3 uses that excerpt properly.

**Cross-reference scope, checked case by case.** A "follow the same steps" note licenses only the operation it names. The Certificates note covers adding or viewing an attachment, not the survey workflow; the Stores note covers the bulk-update steps after its own entry button; the Crew Pool note covers filling the form via the In-Progress steps. No run widened a cross-reference to a whole form or module; the defects above are the reverse, declining to apply a reference that does cover the asked operation.

#### The two uncertain classifications, resolved

**prep-3 — not an answer failure.** The preferred chunk (Audit Preparation Office p.20) was not retrieved, but the supplied §4.3.4 p.19 excerpt states "uploaded attachments are displayed under the corresponding question, where they can be **viewed, downloaded, or deleted**", and the same excerpts give the upload action. Every required claim is supported; nothing in the answers is unsupported. Recorded as correct, with a note that the expected chunk was not the one retrieved.

**pmsoffice-5 — evidence exists, is indexed, and was not retrieved.** The vessel-side dashboard filter section is in the corpus and in the index: Technical PMS Vessel manual p.9, §1.1.3.2 "How to use filter" — "Select the required criticality level to filter equipment or work orders." It was not among the five excerpts in any of the three runs; the vessel **Reports** filter section (p.46) was retrieved instead. So this is a retrieval defect, not an unknown. Runs 1 and 2 were right to state the limitation; run 3 was wrong to conclude a difference from the wrong screen.

#### Correction to §14.8: no manual sentence is missing from the index

§14.8 listed "two manual sentences exist in no retrievable chunk". **That is wrong.** Checked against the indexed chunk text:

| case | expected chunk | indexed? | holds the required phrases? | what actually happened |
|---|---|---|---|---|
| prep-3 | Audit Preparation Office p.20 "Document" | yes | yes, both | not retrieved; adjacent sections supplied the same facts |
| sms-office-1 | SMS Office p.21 "4.2.2 Approval" | yes | yes | not retrieved; only 4.1.2's own content was |
| master-review-2 | Master Review p.11 "4. Office closeout" | yes | yes, both | displaced from the five by the lexical rescue |
| hist-1 | Audit History p.16 "3.3 Review page" | yes | yes | question routed to Technical, so this manual was never a candidate |
| pmsoffice-5 | PMS Vessel p.9 "1.1.3.2 How to use filter" | yes | n/a (comparison case) | not retrieved; the Reports filter section came instead |

Three states must be kept apart: **absent from the manual**, **absent from the index**, **present but not retrieved**. All five are the third state, so all five are addressable by routing and selection rather than by re-extraction. No manual is re-parsed.

#### Judge artefacts observed while reading (fixes in §15.5)

Literal phrase matching fails on markdown emphasis inside a phrase, on tense, on singular versus plural and on inserted words. The citation check reads only the first of five citations. A forbidden phrase fires inside a negation ("Do not create a new approver record"; "does not require exporting them one at a time"). None of these is an answer fault.

### 15.3 Step 3 — the fresh validation set, corrected before its first run (`indexer/fresh_cases.json` 2026-09-18.2; the original kept verbatim as `fresh_cases.v1.json`)

Ten source-backed questions authored from the manual chunk text on 18-Sep and frozen before any fix was tested: five ordinary procedures and conditions (Audit History, Fleet Notification vessel side, Master Review tabs, Crewing filters, Certificates filters), one alternatives case on the manual side (three ways to start a MoC), the broad versus named work-order pair, and two module-context cases. They are held out of tuning — the selection calibration in §15.4 deliberately excludes them — and if a result later guides a fix, the affected case is relabelled a development case.

Corrections made before the first run, each preserved in the file's own change log:

| case | correction |
|---|---|
| fresh-wo-named-1 | the forbidden item is no longer the string "Unplanned W.O". What fails is an **instruction** to use the unplanned route for a question about the Components "Generate WO" action; a one-line note that other methods exist is allowed, as prompt v5 permits |
| fresh-incident-1 | now also checks the view and edit actions on a notification, not only the filtering |
| fresh-technical-1 | now also checks the Fleet and Add Group filters alongside Vessel, Due Status and Clear |
| fresh-audit-1 | "next" replaced by the destination it leads to (the Observation page), so an unrelated use of the word cannot satisfy it |
| fresh-safety-1 | both sides of the All / Response Pending contrast are required |
| fresh-crewing-1 | the named filter fields and the column-header filter behaviour are required, not the bare word "column" |
| fresh-moc-alt-1 | all three creation routes required |
| fresh-wo-broad-1 | adds the attribution rule: automatic generation and the office Generate Now action may appear only if attributed to the draft code-derived guidance |
| fresh-ctx-1 | adds the module expectation (Safety), so the context test is scored rather than the topic words |
| all cases | a `score_by` rubric decides the verdict — meaning, conditions and source support. Literal phrase matching is an aid to the reader, never the verdict on its own |

### 15.4 Step 4 — the demonstrated fixes, chosen on measurement (`diag_fixes.txt`, `calib_select.py`, `replay-v6.json`)

**Diagnosis first (embeddings only, no answer calls).** Each defective question was re-run through the real retrieval path and the position of the expected chunk recorded:

| defect | what the measurement shows |
|---|---|
| hist-1 routed to Technical | Technical's nearest chunk is 0.875 (a Ship-Side operational note about approvals); the correct Audit History page is at 1.020, vector rank 5 overall. No corpus-derived term distinguishes the question — "history" is a generic word the intent router deliberately drops |
| master-review-2 evidence displaced | the expected Part E chunk is the **fifth** vector hit (0.951); the unguarded rescue replaced it with the lexical leader at 1.007 |
| prep-3, sms-office-1, pmsoffice-5 not retrieved | in each case the rescue also displaced a nearer chunk with a farther one (1.078 → 1.147, 0.691 → 0.930, 0.901 → 1.035) |

**The rescue was the common cause.** Across 77 suite questions the unguarded rescue made 23 swaps and **22 of them displaced a nearer chunk**. The four swaps that actually helped all scored 0.6 to 0.93 per content word and cost at most 0.12 of distance; the harmful ones scored below 0.45 per word or cost more.

**Fix adopted — r7, a guarded rescue.** The lexical leader may take the last slot only when it earns it on both counts: score per content word at least 0.45, and distance no more than 0.15 worse than the excerpt it would displace. Measured on the same 77 questions:

| selection variant | expected source among the five | swaps | swaps that lost a nearer chunk | total distance lost |
|---|---|---|---|---|
| vector only (served) | 69/77 | 0 | 0 | 0.00 |
| r6 unguarded rescue (D4) | 72/77 | 23 | 22 | 1.90 |
| **r7 guarded rescue** | **73/77** | **8** | 8 | 0.41 |

r7 beats both: it keeps the Master Review evidence r6 lost **and** keeps all four work-order and routing gains.

**Routing fix attempted and NOT adopted.** Two "second opinion" variants were implemented and measured — give the last slot to the runner-up module's best chunk when the module decision is close (r8), or choose that module by lexical strength (r8c). Neither recovers hist-1, because the nearest runner-up is Safety at 1.002 rather than Audit at 1.020, and both cost the r7 gains. The code stays behind `ASSISTANT_SECOND_OPINION_GAP`, default 0 = off, with the measurement recorded. **hist-1 remains an open defect** and is reported as such rather than claimed fixed.

**Prompt v6, versioned and compared on identical captured inputs.** Three sentences were added to v5, each answering a demonstrated defect: use the evidence you were given before claiming something is missing; adapt steps to the variant the question asks about; compare two things only when both are in the excerpts. v5 keeps its hash `ff9ee87141ac1362`; v6 is `d372abf3b93cc481`, which is v5 plus a 955-character block with nothing removed. Replayed on the stored requests for the six defective runs plus ten controls (32 calls, 52,532 in / 9,353 out tokens, about $0.02):

| run | v5 on this replay | v6 |
|---|---|---|
| pmsvessel-3 r2 | still hedges: "does not provide a separate transaction-entry flow" | "Bulk updating Stores items follows the same process as Spares, not a separate process" |
| safety-meeting-1 r1 and r2 | no longer states the false limitation, but adds no Part B detail | uses the supplied Part B excerpt (unresolved actions, + Add Action, Save) |
| pmsoffice-5 r3 | "These are not the same fields listed for the PMS Dashboard" | "The excerpts do not document a vessel-side PMS Dashboard filter set, so they do not establish whether it is the same … a different documented interface, not evidence about the vessel-side Dashboard" |
| certsurveys-3 r2, hist-3 r1 | correct on this replay — the original defects did not reproduce, which is answer variance | correct, and the variant steps are adapted explicitly |
| 10 controls incl. master-review-2 and sms-office-1 | correct | correct — both honest limitations stay honest; v6 does not turn a limitation into a guess |

**No manual was re-parsed** and the index is unchanged: every sentence involved is already indexed (§15.2).

### 15.5 Step 5 — judge .5, validated on stored answers only (`indexer/rejudge_base5.py`, `judge5-validation.txt`)

Two demonstrated judge defects fixed. No acceptance requirement was relaxed and no case text changed.

- **Citation.** The expected manual and page may appear at **any** position in the citation list shown to the user, not only first. The top-citation result is still computed and reported, so nothing is hidden. Guard: citation-anywhere applies **only to page-anchored cases**. Where a case matches a manual name with no page, such as "(Operational)", a name can match a different document, which would let a filename stand in for support; those cases keep the strict top-citation rule. That guard is what keeps corrected-claims case 4 failing instead of passing on a lookalike name.
- **Forbidden phrases.** A forbidden phrase inside a negation is not a violation: "Do not create a new approver record" states the manual's own rule.

Validated by re-scoring **eight stored dumps** under .4 and .5. Old scores are preserved and the dumps are untouched.

| change | count |
|---|---|
| citation: expected page was cited, but not first | 260 |
| answer: forbidden phrase was inside a negation | 9 |
| both | 1 |
| **total component results changed** | **270** |
| **overall pass/fail verdicts flipped** | **220** (the figure §15.5 first quoted as 270 — corrected, see §15.7) |
| corrected-claims suite (the lookalike-name risk) | unchanged: 36/42 and 35/42 |

### 15.6 Step 6 — final verification against a clearly identified baseline (`run-s5-suites.sh` → `s5-runs.txt`, `s5-*-dump.jsonl`, `s5-{b0,d5a,d5}-capture.jsonl`, `s5-manuals-rejudge.txt`)

One image, one index, one model, one key; the three arms differ only in two environment flags and the prompt version, so every difference is attributable.

| arm | routing | excerpt selection | prompt | role |
|---|---|---|---|---|
| **B0** | off | off (vector five) | v5 `ff9ee87141ac1362` | the controlled baseline that was missing in §14 — measured on the same build, not borrowed from an older image |
| **D5a** | on | guarded rescue (r7) | v5 | routing + selection only |
| **D5** | on | guarded rescue (r7) | v6 `d372abf3b93cc481` | final candidate |

#### Results, all suites, all-runs-required (the stricter of the two rules; the suites' own majority rule is noted where it differs)

| suite | B0 | D5a | D5 | notes |
|---|---|---|---|---|
| routing probes 13 (embeddings only, deterministic) | 8 | **13** | **13** | the three case-05 context variants plus the two work-order intents |
| retrieval 18 (top-1 source) | 18 | 18 | 18 | no regression from either change |
| frozen 12 ×3 | 11 | **12** | 10 (11 by reading) | D5a fixes case 05. D5's two drops: case 7 run 1 is a judge artefact ("the same procedure as Spares" does not match the attribution phrase list); case 8 run 3 is a **real defect** — it offers the Crew Database export, which the case forbids as a different sub-module |
| corrected claims 14 ×3 | 12 | 10 | 12 | D5a's two drops are single runs (2/3) on cases B0 and D5 pass; variance, not a measured effect of the selection change |
| work-order 8 ×3 | 5 | **7** | **7** | generic-03 0/3 → 3/3 and phr-02 1/3 → 3/3 are repeatable gains; phr-04 (D5) and generic-02 (B0, D5a) are 2/3 variance |
| fresh validation 10 ×3 (first run, held out of tuning) | 9 | **10** | **10** | the only baseline failure is fresh-audit-1 at 2/3 |
| manual coverage 57 ×3 (support re-checked against the captures) | 34 | **35** | 32 | every one of D5's five losses is a single run failing a literal phrase while answering correctly: "cannot edit" for "cannot modify", "Actions Due" for "action(s) due", "has passed its due date" for "past their due date", "before … can be modified" for "cannot be modified", and one honest caveat about a sub-category that trips the not-covered word list |
| **total cases (101)** | **71** | **74** | **71** | |

#### What is repeatable and what is noise

Deterministic, no model variance: **routing 8 → 13 of 13** and **retrieval unchanged at 18/18**. Repeatable across all three runs: the two work-order intents, frozen case 05, fresh-audit-1. Everything else that moves between arms is a single run of three on a case the other arms pass — the ±4–8 band on the 57-case suite measured in §15.1.

**On prompt v6 the suite evidence is neutral to slightly negative**, while its benefit was demonstrated only on the replay of the six defective inputs (§15.4). D5 and B0 finish level on the aggregate (71 each) and D5a is ahead (74). The defects v6 targets are 6 runs in 171 — about 3 % — which this suite cannot resolve at ×3.

#### Cost, latency and usage, measured on this run (`convlog-s5.jsonl`, `usage.py`)

| arm | answers | tokens in / out per answer | cost per 1,000 questions | latency mean / median / p95 |
|---|---|---|---|---|
| B0 | 297 | 1,534 / 308 | $0.68 | 3.96 s / 3.43 s / 7.84 s |
| D5a | 303 | 1,542 / 311 | $0.68 | 4.00 s / 3.39 s / 8.43 s |
| D5 | 303 | 1,734 / 281 | $0.68 | 3.78 s / 3.18 s / 8.01 s |

Measured with three arms answering concurrently on one host. The whole step-6 run cost about $0.62 for 903 answers; the step-4 diagnosis and the v6 replay together cost about $0.02.

#### Package identity

| item | value |
|---|---|
| image | `sail-assistant-py:v6-r7` **bd71948a7fdf** (server build of this branch's `app/`; Dockerfile unchanged; runs as uid 10001) |
| model / sampling | `gpt-5.6-luna`, `CHAT_TEMPERATURE=default` |
| embedding model | `text-embedding-3-large`, 3072 dims, one call per question |
| key | the dedicated assistant key (`~/central-assistant/assistant-luna.env`, mode 600) |
| prompt | D5a: v5 `ff9ee87141ac1362` · D5: v6 `d372abf3b93cc481`; tool-loop `7a028346c1c2fdf0` unchanged |
| retrieval configuration | floor 1.15 · margin 0.07 · top_k 10 · 5 excerpts · `ASSISTANT_ROUTE_INTENT=on` · `ASSISTANT_HYBRID=rescue` with `ASSISTANT_RESCUE_LEX_PER_TERM=0.45` and `ASSISTANT_RESCUE_MAX_PENALTY=0.15` · `ASSISTANT_SECOND_OPINION_GAP=0` (measured, not adopted) |
| index identity | `kb-pilot-c`, 916 chunks, 30 documents — unchanged; no manual re-parsed, no chunk re-embedded |
| judges | base .5 (citation-anywhere for page-anchored cases, negation-aware forbidden phrases), work-order .11, manual suite 2026-09-15.1, fresh 2026-09-18.2 |

#### Remaining limitations

1. **hist-1 routing is unfixed.** The Audit History review question still goes to Technical. Two second-opinion variants were measured and neither works; the module-level signal is genuinely against us (the wrong module's nearest chunk is closer).
2. **Answer variance dominates the suites at ×3.** Differences of one to three cases between arms are not evidence. A larger repeat count, or judging by reading, is needed to resolve changes of that size.
3. **Judge gaps still reported, not patched:** the attribution phrase list misses "the same procedure as"; the not-covered word list fires on an honest caveat about one sub-item; literal phrase matching still undercounts paraphrases (five cases in this run alone).
4. **Two manual pages are still not retrieved** (prep-3's preferred chunk, sms-office-1's section 4.2.2) although both are indexed; the answers are correct from adjacent sections.
5. **One real answer defect in this run:** frozen case 8 run 3 offers the Crew Database export as an alternative, which the case forbids.

#### Recommendation

**Do not deploy anything yet.** If a candidate is to be promoted, the evidence supports **D5a — routing on, guarded rescue, prompt v5**: it is the only arm that improves every deterministic measure with no measured regression outside the variance band, and it is ahead on the aggregate (74 of 101 against 71 for the baseline).

**Prompt v6 should be held.** Its three rules demonstrably fix the wording defects on the exact inputs that produced them, but the full suites show no aggregate gain and one real new defect. The cheap way to settle it is to replay v5 against v6 on all 171 stored manual-coverage inputs (about 342 calls, roughly $0.12, no service change) and judge the differences by reading. That decides v6 on evidence rather than on a 3 % subset.

#### Rollback procedure (for review; nothing is deployed)

Nothing has been deployed, so today's rollback is simply `docker rm -f` on the candidate containers; the live service on 8017 has never been touched and keeps its own image, index (`repaired`, 911), prompt v2, gpt-4o-mini and the borrowed key.

If a candidate is ever promoted, rollback is an environment change, not a rebuild, because every change in this package is flag-driven:
1. `ASSISTANT_ROUTE_INTENT=off`, `ASSISTANT_HYBRID=off`, `ASSISTANT_DOCS_PROMPT=v5` restores the served behaviour byte for byte inside the same image; restart the container (about 10 seconds).
2. If the image itself must be rolled back, redeploy the previous tag and point `ASSISTANT_INDEX_SET` at `repaired`; the index sets are separate rows in the same table, so no data is migrated or deleted in either direction.
3. Verification after rollback: `/health` must report the expected `indexSet`, `chunks`, `prompt.version` and `docsPromptSha`, and the retrieval-18 probe must return 18/18 with no model calls.
4. The dedicated key is scoped to the two models it needs; no shared key is revoked or rotated by any of this.

### 15.7 Reviewer's second pass (18-Sep) — the requested full answers, read (`s5-evidence-pack.txt`, split per suite in `for-astra-2026-09-18/`; no new model calls)

The reviewer asked for the complete stored answers and their captured inputs for the corrected-claims losses, the remaining work-order failure, the manual-coverage losses and the fresh validation cases, plus the judging rule for corrected-claims case 06, and asked that genuine answer defects be separated from scoring defects. All of it below comes from the stored run; nothing was re-asked.

**Reporting correction accepted.** The judge validation changed **270 component results** but **220 overall pass/fail verdicts**. §15.5 quoted the component figure as if it were the verdict figure. Both numbers are now stated: 270 component changes, 220 verdict flips.

#### A. Corrected-claims case 06 — the reviewer was right, and the problem is larger than the answer

The case asks "Who can generate work orders from the office, and what happens if the vessel's switch is off?" and its rule is: the answer **must** contain "sail admin" and "not enabled".

The two sources supplied in the same request disagree:

| source in the excerpts | what it says |
|---|---|
| corrected code-derived doc, Recent Updates §1.1.14.6 | "**Only a Sail Admin can generate work orders directly from the office**, and only for a vessel whose 'office work-order generation' switch is enabled" |
| KB pilot file, "How work orders are created" | "Who can do it (role): … office 'Generate Now': Sail Admin only; (2) per-job 'Generate WO': **no role check**; (3) unplanned: no role check" |

So the blanket sentence in the corrected document is **over-broad**: the per-job Generate WO route is also performed from the office and has no role check. Reading all nine stored runs of case 06:

| arm · run | what the answer says | verdict |
|---|---|---|
| B0 r1 | "From the office, only a Sail Admin can generate work orders", then describes only Generate Now | **over-broad — real defect, and the judge PASSED it** |
| D5 r2 | "Only a Sail Admin can generate work orders directly from the office", then only Generate Now | **over-broad — real defect, judge PASSED it** |
| B0 r2, r3 · D5a r1, r2 · D5 r1, r3 | split by action: Generate Now = Sail Admin only; per-job Generate WO = no role check | correct |
| D5a r3 | split by action, correct | **failed on a scoring defect** (below) |

Three consequences, none of which needs a model call:
1. **The case expectation is defective.** Requiring "sail admin" without requiring the per-action split rewards the over-broad answer. The case must require both the Generate Now role rule **and** that the per-job route carries no role check, and must forbid presenting Sail Admin as the condition for all office generation. This changes an acceptance requirement, so it is proposed here rather than applied — and it makes the suite **harder**, not easier.
2. **The corrected code-derived document has an over-broad sentence.** Recent Updates §1.1.14.6 should be qualified to "only a Sail Admin can use the office **Generate Now** action". That is a documentation change and needs the owner's approval; it also means the earlier §14 statement that the corrected documents "add exactly the code-derived claims" was too generous about this one sentence.
3. **Two stored runs are real answer defects** that the current judge passes, so the corrected-claims scores in §15.6 are optimistic by one case on B0 and one on D5.

#### B. The two corrected-claims losses on the routing candidate are scoring defects

| case · run | the sentence that failed it | why it is not an answer defect |
|---|---|---|
| 06 · D5a r3 | "the June PMS user manual excerpt only defines work orders and **does not cover** these office-generation rules" | an accurate statement about one source, which prompt v5 explicitly asks for. "does not cover" is on the forbidden list, whose purpose is to catch the assistant declining to answer |
| 07 · D5a r3 | "those capabilities are **not covered** as available to that role" | this is the substance of the correct answer ("No, a Head of Department cannot do everything"), not a refusal |

Both answers are complete and correct by reading. The forbidden list fires on a phrase describing **a source's** coverage rather than the assistant's own inability. Reported as a judge defect; a narrow rule (ignore a not-covered phrase that is scoped to a named source, keep it when the answer declines outright) is **proposed, not applied**, because it would move published scores.

By reading, the corrected-claims column of §15.6 becomes: B0 11, D5a 12, D5 11 — the reverse of the automatic 12 / 10 / 12.

#### C. The remaining work-order failure is also a scoring defect

D5, wo-phr-04 run 1, judged "Generate WO switch stated without the office qualifier". The answer says, inside that very step: "In the **Office**, select the vessel and ensure its **office work-order generation switch is ON**. This switch is not required on the Ship." The qualifier is present and correct; the judge's scope window missed it. By reading, D5 is **8/8** on work orders.

The genuine work-order content gaps in this run are on the other arms: the baseline misses the overview entirely on wo-generic-03 (all three runs) and omits the note of other methods on wo-phr-02 (two runs); one run each of B0 and D5a describes Generate Now without its Sail Admin and switch conditions.

#### D. The two manual-coverage losses on the routing candidate are scoring defects

| case · run | required phrase | what the answer said |
|---|---|---|
| crewing-1 · D5a r1 | "recruitment application" | answers both halves of the question (click "+ New Crew"; yes, Save Draft at any stage). The form's name was not asked for |
| fn-1 · D5a r1 | "all actions" | "Updated the Date Closed/completion date and status for **all pending actions**" |

Both correct by reading. This is the same literal-matching gap already reported, and it is why §15.6 reports the automatic figure and the reading separately.

#### E. The fresh set — the reviewer is right that the automatic pass is not a review

Read against each case's own rubric, the module-context conflict case reverses:

| arm | what happened | rubric verdict |
|---|---|---|
| B0 baseline | routed to **Technical** and gave the Technical add-component procedure, while noting the Safety framing is not covered | **fails** — the rubric's acceptable outcomes are routing to Safety and saying it is not covered there, or asking which module is meant |
| D5a, D5 | routed to **Safety** and answered "Adding a new component to the component tree is not covered in the provided Safety documentation" | correct |

The automatic runner passed the baseline because this case has no required phrases and its expected module is deliberately "Safety or a clarification", which the runner does not score. So the fresh-set result by reading is **baseline 8/10, both candidates 10/10** — a wider gap than the automatic 9 / 10 / 10. The other module-context case (safety meeting minutes asked from a Technical screen) routes to Safety on all three arms and answers from the Safety Meeting manual.

#### F. Where this leaves the comparison

| suite | B0 automatic → by reading | D5a automatic → by reading | D5 automatic → by reading |
|---|---|---|---|
| corrected claims 14 | 12 → **11** | 10 → **12** | 12 → **11** |
| work orders 8 | 5 → 5 | 7 → 7 | 7 → **8** |
| fresh validation 10 | 9 → **8** | 10 → 10 | 10 → 10 |
| routing 13, retrieval 18 | 8, 18 | 13, 18 | 13, 18 |

The manual-coverage and frozen suites were not re-read in full for this run; the differences examined (two on D5a, five on D5, plus the two frozen drops) are described in §15.6 and above. Reading moves every examined difference in the same direction: the candidates gain and the baseline loses, because the baseline's failures are content gaps while the candidates' are wording and scope artefacts of the judges.

**The recommendation does not change: deploy nothing yet.** Two items now block any promotion decision, and neither requires a model call: the case-06 expectation must be corrected and the over-broad sentence in the corrected document decided by the owner; and the two judge defects above should be settled before any score is quoted as final.

### 8.6 Not changed / open

Not changed: live, prompt (v2 on both instances), retrieval logic, thresholds, excerpt count, the frozen suites, the base judge's literal must-phrase check. Open for the owner: (1) the answer-generation drops now dominate — the conditions rule (prompt v3) targeted this and regressed frozen case 09 (§S.7.1); a reworded rule or a content-ordering change are the untested candidates; (2) two retrieval residues (wo-generic-03; wo-phr-02's "other ways" note, which could also be one sentence in unplanned-wo.md); (3) the literal must-phrase check in the shared base judge fails wo-phr-03 answers that are right by meaning.

## 16. Reviewer's GO of 18-Sep — document correction, judge corrections, corrected-document candidate (candidate only; live, nginx, SMS RAG, other sites and shared credentials untouched; nothing deployed)

The reviewer gave a GO for five items: correct the affected document section, resolve the
hardcoded-identity caveat accurately, finish the judge corrections **before** any new model call,
rebuild only the v5 candidate on an isolated index carrying the corrected document, and run every
existing suite comparing corrected against pre-correction with the same corrected judges. This
section reports each in order. Nothing deployed; no application authentication was changed; the live
assistant (`:8017`), nginx, the SMS RAG service and every other site on the box are as they were.

### 16.1 Item 1 — the document section, corrected in full (`generated-docs/R4/`, `generated-docs/build_r4.py`, `generated-docs/R4/PROVENANCE.md`)

**Which revision is actually indexed — checked, and it was not the one in the repository.** Three
revisions of "Recent Updates & Changed Behaviours (Operational) Notes" exist, and `assistant_documents`
records the sha256 each index set was built from:

| sha256 | revision | index sets |
|---|---|---|
| `6a93bd23…` | R2 | `py-llamaparse`, `ce-clean`, `ag-*` (14 chunks) |
| `d10f3027…` | **R3 — the one in the candidate set** | `repaired`, `kb-base`, `kb-pilot`, **`kb-pilot-c`** (13 chunks) |
| `71bafc19…` | R3.2 = R3 + §1.1.14.13 "How To Create A Work Order" | `repaired-r32` (16 chunks); this is what `generated-docs/R3/` holds today |

The first draft of R4 was built from the repository's copy, which is R3.2. That would have added a
whole new section (§1.1.14.13) to the index alongside the correction, changing far more than the
thing being measured. The indexed revision was recovered from git (blob `619dbb92`, commit
`972f424d7`), sha-verified against the database, kept as
`R3/… .AS-INDEXED-kb-pilot-c.docx`, and R4 was rebuilt from it by a checked-in script.

**The correction itself.** Heading "1.1.14.6 Office Generation of Work Orders Is a Per-Vessel Switch"
→ "1.1.14.6 Office Generation of Work Orders — Conditions by Action"; the four bullets replaced by
six. Removed: the blanket sentence "Only a Sail Admin can generate work orders directly from the
office…" and the two bullets that repeated it. Added, one per action and each with its code
reference:

1. **Generate Now** — role must be Sail Admin **and** the vessel's office work-order generation
   switch must be on (off by default, set on Lead Time & Grace Period Settings).
2. **The three refusals, verbatim** — not a Sail Admin; switch off (with where to enable it); vessel
   state unreadable, which fails closed.
3. **Per-job Generate WO** — the switch plus job state (exists, active, no active work order, reason
   Planning/Breakdown/Other). **No role check on this path.**
4. **Unplanned work order** — neither the role rule nor the switch applies.
5. **Ships** — always generate on their daily scan; a ship instance passes the gate untested.
6. **Applies to all** — authentication and vessel access are separate and always required, plus the
   enforcement note in §16.2.

Every other paragraph is byte-identical: verified paragraph-by-paragraph against the as-indexed file
(before the section: identical; after the section: identical).

**Code evidence and revision.** Read-only, at PMS revision `origin/replit_dev` @ `44c8fccad`:
`workOrderController.ts:133` is the only call site of the full gate → `workOrderGenerationGate.evaluateDirectGeneration`
(`PROVISIONING_ROLE = 'Sail Admin'`, codes `ROLE_NOT_PERMITTED` / `OFFICE_GENERATION_DISABLED` /
`VESSEL_STATE_UNKNOWN`, `isShip` allowed before both tests); `jobService.ts:555-580` is the per-job
path and calls `isOfficeWoGenerationEnabled` and the job-state checks only — it never reaches the
gate; the unplanned create path calls neither. The full claim-by-claim table is in
`generated-docs/R4/PROVENANCE.md`. Evidence class: **READ** — from source at that revision, not
exercised against any running installation.

The document's internal revision line still reads "R3 (September 2026)". It was left alone so that
the only text difference between the two index sets is the corrected section; the revision is
tracked by folder and sha in PROVENANCE.md.

### 16.2 Item 2 — the identity caveat: intended permissions vs effective enforcement

The reviewer asked for this to be resolved accurately rather than hedged, and for it to be said
plainly if a running deployment could not be inspected.

**Intended permission (READ, code).** `evaluateDirectGeneration` refuses any caller whose role is
not `'Sail Admin'`. That is the rule the application intends for the office Generate Now action.

**Effective enforcement (READ, code).** The role the gate tests comes from
`resolveGateRole(user) = user.forwardedRole || user.role`.

- `user.forwardedRole` is set from the `x-user-role` request header (`middleware/auth.ts:197`). The
  PMS client does send it (`client/src/lib/activeRank.ts:127`).
- `user.role` is the literal string `"Sail Admin"` (`middleware/auth.ts:186`) — a fixed development
  identity, not derived from the request.

So the condition binds only when a role header actually reaches the server. **Any request that
arrives without `x-user-role` is evaluated as a Sail Admin and passes the role test.** The header is
also supplied by the caller, so it is an attribution signal rather than a verified credential. That
is the honest gap between the intended permission and what the code enforces, and it is now stated
in the document in those terms.

**`PMS_AUTH_MOCK_RBAC` does not apply here**, and an earlier draft of the bullet that cited it was
wrong. That flag sets `req.rbac`, which the Phase-0 identity guards read; this controller reads
`req.user`. The flag was removed from the document before the measured run, and the sequence is
recorded in PROVENANCE.md rather than quietly fixed.

**Running-deployment access: none was used, and none is claimed.** No request was made to production
or to any customer installation. The local shore+ship pilot was checked and is **not running**
(ports 5000 and 5100 refused), and by a standing project rule pilot authentication does not
generalise to production, so starting it would not have answered the question. Therefore:

| question | answer | class |
|---|---|---|
| What role does the code require for Generate Now? | Sail Admin | READ |
| What does the code test that role against? | the forwarded header, else a fixed 'Sail Admin' | READ |
| Does a caller without the header pass? | yes | READ |
| Does every real caller in deployment X send the header? | **not measured — unknown** | — |
| Is `PMS_AUTH_MOCK_RBAC` set in deployment X? | not inspected, and it does not affect this gate anyway | — |

Nothing in the application's authentication was changed by this work.

### 16.3 Item 3 — judge corrections, finished before any new model call

Both changes were made and validated against stored answers only, with no service or model calls.
Old results are preserved: nothing was rewritten, and each earlier behaviour is still reproducible
by a flag.

**(a) Corrected-claims case 06 — the expectation, corrected (`acceptance_generated.py`, suite
`2026-09-18.3`).** The case required only "sail admin" and "not enabled", which rewarded the
over-broad answer. It now requires the per-action split: the Generate Now role rule, the per-job
`Generate WO` route, **and** a statement that the per-job route carries no role check. The last is
matched through a new `||` alternation in the base judge, because one fact has several natural
wordings ("no role check", "no specific role", "no special role", "any signed-in user", …). The
alternation is opt-in per phrase; no other case uses it, so no other case changes.

No `must_not` clause was added for the blanket sentence. Every wording that would catch it also
matches the refusal message the corrected document now documents verbatim ("Only a Sail Admin may
generate work orders directly from the office."), which a correct answer may quote. The required
split rejects the blanket answer on its own: an answer that states only the blanket rule cannot also
state the per-job exception.

**(b) Base judge .7 — the "no steps and little content" shortcut, removed (`acceptance_answers.py`).**
The reviewer's objection was right: length is not evidence, and a long answer can still falsely claim
evidence is missing. The length test is gone. Each sentence that asserts a decline phrase is now
classified by what it is about:

| class | what it means | violation? |
|---|---|---|
| refusal | first-person inability, or "no information" | yes |
| false-evidence | says the case's **own expected source** does not carry the answer | yes |
| contradicted-by-own-citation | says the evidence base as a whole ("the provided documentation", "the supplied excerpts") lacks it, **while the answer cites the expected manual and page** | yes |
| limitation-not-retrieved | the same whole-evidence claim when the expected source was **not** among the citations — the assistant is describing what it was actually given | no |
| limitation | the gap is scoped to some **other** named source, or to an attribute rather than to the evidence | no |

That is the distinction asked for: an accurate limitation of a named source is kept, an unsupported
refusal or missing-evidence claim is not, and "unsupported" is decided against the answer's own
citations rather than against its length. `JUDGE_DECLINE_SCOPE=False` reproduces .6 exactly, and with
`JUDGE_DECLINE_AWARE=False`, .5.

**Validation on stored answers (`indexer/rejudge_base7.py`, `base-judge7-validation-s5.txt`,
`base-judge7-validation-all.txt`).** Three scorings are computed over the same rows so the two
effects never blur: A = judge .6 with case 06 as published (the numbers already reported), B = judge
.7 with case 06 as published (the judge change alone), C = both (final).

Across **every** stored dump in the pilot (14 files, all arms of every run since 11-Sep): the judge
change moves **4 verdicts**, all in the same direction — a run that passed now fails. Every one is
listed with its sentence. All four were read against the full answer:

| dump · arm · case · run | the sentence | read |
|---|---|---|
| s5 · D5a · pmsvessel-3 · r3 | "The detailed Store transaction steps are not covered in the provided documentation." | **genuine defect.** The Vessel manual's own §1.1.8.3 says "Refer to the 'Spares' sub-sub-module and follow the same steps", the answer quotes that step, and it cites p.43 and p.40 — the claim is contradicted by its own citations |
| abc · B-corrected · case 07 · r2 | "…are not documented for Heads of Department in the provided excerpts." | borderline, and reported as such: the "No" is right, but it is grounded on an absence of evidence when §1.1.12.6 documents the limits positively |
| abc · B-corrected · safety-meeting-1 · r3 | "the provided excerpts do not include the full Part C or Monthly Safety Meeting instructions" | **genuine defect.** The citation list includes §1.6 p.10, Part B p.11 and Part D p.14 of that manual |
| s4c · D4-rescue · safety-meeting-1 · r2 | the same claim | same |

The decline-phrase audit over all dumps: 54 asserted occurrences, classified 48 limitation, 4
whole-evidence-contradicted, 2 false-evidence (both on runs that were already failing). Every
sentence is printed in the validation file, so the classifier can be checked directly rather than
only through the verdicts it moves.

The case-06 correction moves **2 verdicts in the final run** (s5): B0 run 1 and D5 run 2, the two
answers that state the blanket rule — exactly the two the reviewer identified. It moves 31 verdicts
across all historical dumps. One near-miss is worth recording: B0 run 3 splits by action correctly
but writes "No special role is required"; the first alternation list missed that wording and would
have failed a correct answer. It was found by reading the changed verdicts, and the list was widened
before anything was concluded.

**Re-scored with the corrected judges, the published final run (s5) reads (`score7.py` →
`score7-s5.txt`; both pass rules shown, the runner's own rule marked):**

| suite (rule) | B0 | D5a (v5 candidate) | D5 (v6) |
|---|---|---|---|
| routing 13 (all) | 8 | **13** | **13** |
| retrieval 18 (all) | 18 | 18 | 18 |
| frozen 12 (majority) | 11 | **12** | 12 |
| corrected claims 14 (majority) | 12 | 12 | 12 |
| work orders 8 (all) | 6 | **8** | 7 |
| manual coverage 57 (all) | 34 | **35** | 33 |
| fresh validation 10 (all) | 9 | **10** | 10 |

Under the majority rule the manual-coverage column reads 37 / 40 / 40 and work orders 6 / 8 / 8;
both rules are in `score7-s5.txt` for every suite, per case.

### 16.4 Item 4 — the corrected-document candidate, on an isolated index

Only the v5 candidate was rebuilt. Model, prompt, routing and selection are unchanged and pinned:

| | E0 — pre-correction | E1 — corrected document |
|---|---|---|
| image | `sail-assistant-py:v6-r7` | same |
| prompt | v5, sha `ff9ee87141ac1362` | same (health endpoint confirms) |
| model | gpt-5.6-luna, `CHAT_TEMPERATURE=default` | same |
| routing / selection | `ASSISTANT_ROUTE_INTENT=on`, `ASSISTANT_HYBRID=rescue` | same |
| index set | `kb-pilot-c`, 916 chunks | `kb-pilot-d`, 919 chunks |
| port | 127.0.0.1:8032 | 127.0.0.1:8033 |

`kb-pilot-d` was created as a row-for-row copy of `kb-pilot-c` and then the one document re-indexed
from R4, so unchanged parses and vectors are reused by construction. Verified from the database:

- every **other** document: 0 chunk differences (`EXCEPT` over id + content);
- this document: the only section whose text differs is §1.1.14.6;
- vectors: 12 of the document's 16 chunks served from the stored-vector cache, 4 embedded. Nothing
  else in the 919 was re-parsed or re-embedded.

One artefact is reported rather than tuned away: the longer section spills across a parsed page
break, so `kb-pilot-d` carries one extra "Preamble" chunk holding the tail of the last bullet with no
heading of its own.

### 16.5 Item 5 — every suite, corrected against pre-correction, on the corrected judges (`run-s6-suites.sh` → `s6-runs.txt`, `s6-*-dump.jsonl`, `s6-{e0,e1}-capture.jsonl`, `score7.py` → `score7-s6.txt`, `s6-input-identity.txt`, `s6-evidence-pack.txt`)

Both arms were run fresh in the same invocation, question by question, rather than comparing the new
arm against the stored 15-Sep run — the two arms then share model, key, time and load, and only the
index differs. 101 questions × 3 runs × 2 arms, plus the 13 routing probes and the 18 retrieval
probes, which make no answer call.

**Totals. Both pass rules are given; the rule each runner actually applies is marked.**

| suite | rule applied | E0 pre-correction | E1 corrected | also, the other rule (E0 → E1) |
|---|---|---|---|---|
| routing 13 | all runs | 13 | 13 | — |
| retrieval 18 | all runs | 18 | 18 | — |
| frozen 12 | majority | 12 | 12 | all-runs 11 → 12 |
| corrected claims 14 | majority | **12** | **11** | all-runs 12 → 10 |
| work orders 8 | all runs | **7** | **8** | majority 7 → 8 |
| manual coverage 57 | all runs | **33** | **34** | majority 40 → 38 |
| fresh validation 10 | all runs | 10 | 10 | majority 10 → 10 |

**Before reading any of that as an effect of the correction: how much of it could be?** The outbound
captures answer this directly. Of the 101 questions, **99 received byte-identical model input in both
arms** — same excerpts, same order, same text. Only two questions were sent anything different, and
both are the questions the corrected section bears on:

- "Who can generate work orders from the office, and what happens if the vessel's switch is off?"
- "Which office screen holds the per-vessel switches such as office work-order generation and
  running-hours entry?"

So **every difference on the other 99 questions is answer variance, not an effect of the document.**
Measured: on those 99 questions the two arms disagree on **25 of 297 paired runs (8.4 %)** — listed
case by case in `s6-input-identity.txt`. That is the noise floor of this comparison, and it is
larger than the signal. The seven manual-coverage case-level moves (four gains, three losses), the
one frozen run and the work-order gain on `wo-phr-01` all sit inside it, on identical inputs.

**The one real difference: corrected-claims case 06 — the answer improves, the citation position
regresses.** This is the case whose expectation was corrected in §16.3, and it is now harder.

| | E0 (pre-correction document) | E1 (corrected document) |
|---|---|---|
| answer, all three runs | pass | **pass** |
| top citation | Recent Updates §1.1.14.6 | KB pilot "Office 'Generate Now'" file |
| citation check | pass | **fail, all three runs** |
| case verdict | pass | fail |

Read against the full answers (`s6-evidence-pack.txt`): all three E1 answers satisfy the new
per-action requirement — Generate Now with Sail Admin and the switch, per-job Generate WO with no
role check, unplanned with neither. The case fails purely on **which** citation is first. The cause
is visible in the citation list: E1 retrieves the corrected section **twice** (positions 2 and 4),
because the longer section now spans two chunks — the section chunk and the "Preamble" tail chunk
noted in §16.4 — so each is individually a little less similar than the single pre-correction chunk,
and the KB pilot file takes first place.

Two things follow, and neither is applied:

1. **A judge relaxation is available and is deliberately not taken.** Base judge .5 already accepts
   the expected manual anywhere in the citation list for page-anchored cases; this case has no page,
   where a name substring could match a different document. "Recent Updates" happens to be unique, so
   extending citation-anywhere to it would turn this into a pass. Making that change after seeing
   which arm it helps would be tuning the judge to the result. It is reported, not applied.
2. **A document change is available and is deliberately not taken.** Shortening §1.1.14.6 so that it
   stays in one chunk — for example moving the bracketed code references out of the bullets — would
   very likely restore the top citation. That is also tuning to the test after seeing the result. It
   is a proposal for the owner, not a change made here.

**What the correction did achieve, measured.** The over-broad sentence is gone from the corpus, and
with it the answer defect the reviewer found: across the six E0/E1 runs of case 06 in this run, no
answer states that only a Sail Admin can generate work orders from the office — including the three
pre-correction runs, which now split by action because the case forces it. In the 15-Sep run, under
the corrected expectation, two runs did state the blanket rule (B0 run 1, D5 run 2) and the old
expectation passed them.

**The second changed question, case 14** ("which office screen holds the per-vessel switches"),
passes on all three runs in both arms; the corrected section changed its excerpt text but not its
verdict.

### 16.6 Unresolved defects, and what this run does not settle

Open, with nothing built for them:

1. **Corrected-claims case 06 now fails on citation position** (§16.5). Two clean fixes exist — a
   judge relaxation and a document shortening — and both are withheld because either would be chosen
   after seeing which arm it helps. The owner's call.
2. **The "Preamble" chunk.** The corrected section spans a parsed page break, so its tail is indexed
   as a headingless fragment. It is retrievable on its own. This is a chunking consequence of a
   longer section, not of the correction's content.
3. **Fresh validation `fresh-audit-1` still fails on a literal word.** The rubric asks for "all
   mandatory fields marked with an asterisk"; an answer that writes "fields marked with *" fails
   because the case requires the literal "mandatory". The `||` alternation added in §16.3 would fix
   it in one line, and it would help the **baseline**, not the candidate. It was not applied: the
   fresh set is frozen before first use, and editing a frozen case mid-comparison destroys the only
   thing that set is for. Proposed for the next freeze.
4. **The Audit History routing defect** (§15.4) is unchanged and still open — the two second-opinion
   variants were measured and not adopted.
5. **Base judge .7 fails one borderline case** (`abc · B-corrected · case 07 · r2`): a correct "No"
   grounded on an absence of evidence rather than on the documented limit. Reported rather than
   special-cased.
6. **Run-to-run variance is 8.4 % of runs on byte-identical input** (25 of 297). Any future
   comparison of two arms on these suites needs either paired identical-input analysis, as done
   here, or many more repeats. Single-run deltas on these suites are not evidence.

What this run does **not** settle: whether the corrected candidate should be promoted. It measures
one document correction on an isolated index; the promotion question (D4/D5a vs live) is still the
one from §15.6 and is unchanged by this work.

### 16.7 State of the environment (nothing deployed)

| what | state |
|---|---|
| live assistant `:8017` and `:8015`, nginx, SMS RAG, every other site | untouched; no configuration, no credential, no route changed |
| application authentication (PMS) | unchanged; code read only |
| new containers | `sail-assistant-py-e0` (127.0.0.1:8032, `kb-pilot-c`), `sail-assistant-py-e1` (127.0.0.1:8033, `kb-pilot-d`) — candidate-only, loopback-bound |
| new index set | `kb-pilot-d`, 919 chunks. `kb-pilot-c` and every other set untouched |
| earlier candidate containers `b0`/`d5a`/`d5` (8029–8031) | still running. They were stopped for about two minutes during this session by a container-stop filter of mine that matched more than intended, and restarted immediately; both were verified healthy afterwards. No live service was in that filter |
| documents on the server | `documents/` untouched; the corrected file is staged in a separate `documents-r4/` |
| keys | the dedicated `assistant-luna.env` key was used for the 4 new embeddings and for every answer; no key was borrowed, moved, written to disk or printed |

## 17. Second reviewer GO of 18-Sep — bounded corrections and verification (candidate only; live, nginx, SMS RAG, other sites and shared credentials untouched; nothing deployed)

Five bounded items: correct the citation scoring, keep each action's conditions and qualification together, finish
the demonstrated scoring corrections, record the authorization finding separately, and rebuild and verify. Judge
changes were validated on stored answers **before** any model call, as instructed. Every container operation in
this session used an explicit container name — no `--filter` was used to stop anything.

### 17.1 Item 1 — citation scoring corrected (base judge .8; `indexer/validate_judge8.py` → `base-judge8-validation.txt`)

A supporting citation is now accepted **anywhere** in the user-visible list, and the acceptance is made stricter,
not looser, in three ways:

| | .7 | .8 |
|---|---|---|
| which document counts | the case's manual string appears **as a substring** of the citation name | the string is resolved against the corpus document list (`indexer/corpus_documents.txt`, 30 documents) and the citation must be that document **exactly** |
| section / page | required only for page-anchored cases | unchanged — required wherever the case gives one |
| does the cited text support the answer? | not tested | the cited document's text must have been **supplied to the model** and must carry a required phrase; otherwise the citation does not count |
| first place in the list | conflated with the pass for unpaged cases | computed and reported **separately**, never folded into the pass |
| undecidable | — | flagged REVIEW-NEEDED for source-based review, not passed or failed on a guess |

"(Operational)" names four different corpus documents; "Technical -" names fourteen. A name-substring rule cannot
tell them apart, which is why exact identity and a supplied-text test were added together.

**Validated on 1,245 stored runs** across the 15-Sep and 18-Sep runs (1,239 of them with the captured model input).
**18 verdicts change, all citation false → true, every one with `support=supported` and `first-source=False`** —
that is, the answer was supported by the expected document, which was not listed first. They are corrected-claims
case 04 on all three arms of both runs, and case 06 on the corrected-document arm, which is the case the reviewer
raised. No verdict moves in the other direction.

**Negative controls** (fixtures built from real stored answers — they show what the rule rejects, not that the
situation occurs):

| control | .7 citation | .8 citation |
|---|---|---|
| wrong document substituted in every citation | False | False |
| **lookalike document** — another document matching the same name substring | **True** | **False** (support=not-supplied) |
| lookalike document and its text not supplied | **True** | **False** |
| right document cited, its text never supplied | True (on an unpaged case) | **False** |
| page-anchored case, every page forced to 999 | False | False |

The second row is the point of the change: under .7 a citation naming *any* "(Operational)" document satisfied an
"(Operational)" case. Under .8 it does not, because the name must resolve to that exact document and its text must
have reached the model.

### 17.2 Item 2 — conditions and qualification kept together (`generated-docs/R5/`, `build_r5.py`, `R5/PROVENANCE.md`; KB files in `kb/technical/work-orders/`)

**The defect, measured.** The captured input for the generation question ended:

```
* Applies to all of the above: n
```

Cause, in the chunker (`indexer/chunking.py`, unchanged): it splits **each page's** markdown by headings, then cuts
each section into 1200-character pieces with 150 overlap. R4's single section was ~1,900 characters and crossed a
page break, so it was char-split *and* its tail was orphaned into a headingless "Preamble" chunk.

**The fix is structural, not editorial.** §1.1.14.6 is now a short lead plus **five sub-sections, one per action**,
each on its own page, each carrying its own role, switch and job-state conditions **and its own enforcement
qualification**. The document got longer, not shorter (38 → 50 paragraphs, 4 → 7 parsed pages); nothing was cut to
improve ranking, and every `[code: …]` reference is preserved. Every paragraph outside the section is
byte-identical to the revision it was built from.

Measured in the new index set:

| page | section | chars | carries its enforcement note |
|---|---|---|---|
| 2 | 1.1.14.6 lead | 342 | yes |
| 3 | 1.1.14.6.1 Generate Now | 1087 | **yes** |
| 4 | 1.1.14.6.2 refusal messages | 635 | (messages) |
| 5 | 1.1.14.6.3 per-job Generate WO | 1006 | **yes** |
| 6 | 1.1.14.6.4 Unplanned | 550 | **yes** |
| 7 | 1.1.14.6.5 Ship generation | 251 | (no role or switch condition) |

**Headingless "Preamble" chunks for this document: 0** (R4 produced one), and no section exceeds the 1200-character
piece, so no action can be char-split away from its qualification.

**KB files reconciled.** The KB pilot procedures stated the refusal unconditionally ("the other two roles see a
button whose every click is refused"). Three files now carry the same enforcement qualification as the document,
with the policy wording unchanged and every code reference preserved: `office-generate-now.md`,
`how-work-orders-are-created.md`, `office-generate-wo-per-job.md`. The other two KB files were not changed and
their stored vectors were reused.

### 17.3 Item 3 — the demonstrated scoring corrections, finished

**(a) Missing-evidence claims are now tested against the supplied excerpts.** .7 used a proxy — "does the answer
cite the expected manual?" — which is exactly what the reviewer said not to use. .8 parses the captured
`Manual excerpts:` block, takes the distinctive content words of the sentence that claims something is missing, and
asks whether those words are in what was supplied:

| result | meaning | verdict |
|---|---|---|
| the supplied excerpts do carry it | the claim is false | fail |
| they do not | the statement is honest | not a violation |
| no captured input, or fewer than two distinctive terms | not decidable | **REVIEW-NEEDED**, neither passed nor failed |

Over the stored runs, seven sentences assert a missing-evidence phrase. Five keep their class; **two change, and in
opposite directions** — which is the point:

| run | sentence | .7 | .8 |
|---|---|---|---|
| s5 · D5a · pmsvessel-3 r3 | "The detailed Store transaction steps are not covered in the provided documentation." | contradicted-by-own-citation | **false-evidence** — the supplied text carries "Store", "transaction" and "steps" |
| s6 · E1 · pmsvessel-3 r1 | "…it is not documented as a completely separate update workflow." | contradicted-by-own-citation | **limitation** — the supplied text really does not say that |

Answer length, citation presence and the absence of a preferred citation no longer enter the test at all.

**(b) The "mandatory" / "fields marked *" correction is applied.** `PHRASE_EQUIV` is a documented, versioned table
of wordings that satisfy a required phrase; "mandatory" is satisfied by "fields marked with *", "marked with an
asterisk", "marked (*)" and so on. This changes how an answer is **matched**, not what the question requires, which
is why a frozen suite can take it. It is applied identically to both arms and the earlier scores are preserved
(`JUDGE_PHRASE_EQUIV=False` reproduces them). Its effect on the 18-Sep run: fresh validation `fresh-audit-1` stops
failing on the literal word — a gain for the **baseline** arm, not for the candidate.

**(c) Action-specific permission checks are retained and tightened.** Corrected-claims case 06 previously required
its phrases anywhere in the answer. In suite version `2026-09-18.4` the requirements are **action-scoped** through
the same block-scoping machinery the work-order judge uses (`acceptance_wo.scopes_v7`): "sail admin" must sit in the
block that names **Generate Now**, and the no-role-check statement must sit in the block that names **per-job
Generate WO**. An answer can no longer pass because the required words exist somewhere in the text.

### 17.4 Item 4 — the authorization finding, recorded separately (`docs/SECURITY-FINDING-2026-09-18-wo-generation-role.md`)

Written as its own note rather than as a line in a user document. In summary, all **READ** from source at
`origin/replit_dev` @ `44c8fccad`:

- **Intended policy:** office 'Generate Now' is restricted to Sail Admin, on top of a per-vessel switch that is off
  by default and fails closed.
- **Effective enforcement:** the gate resolves the role as `forwardedRole || user.role`. `forwardedRole` comes from
  the `x-user-role` request header; `user.role` is the fixed string `"Sail Admin"`. **A request with no role header
  is evaluated as a Sail Admin.** Every other condition in the same function fails closed; this one fails open.
- The gate reads `req.user`, the legacy field the middleware comment reserves for business logic, rather than
  `req.rbac`, the Phase-0 identity that reports `role: null` when nothing was forwarded and would have refused.
- `PMS_AUTH_MOCK_RBAC` drives `req.rbac` and therefore does **not** affect this gate. An earlier draft of the
  document correction cited it here and was wrong; that is recorded rather than quietly fixed.
- **Limits, stated in the note:** no production or customer installation was accessed; whether a proxy strips or
  sets `x-user-role` before requests reach the application was not inspected; the local pilot was down and its
  authentication does not generalise. **No claim is made that production exposure exists.** The note says what one
  request against an owner-nominated deployment would settle, and names a one-function candidate fix — neither was
  done.
- Roughly a dozen other server files read `user.role`; whether any has the same open fallback was **not**
  determined and no claim is made about them.

No application authentication or permission code was changed by this work.

### 17.5 Item 5 — rebuild and verification (`run-s7-suites.sh` → `s7-runs.txt`, `s7-generated-runs.txt`, `s7-*-dump.jsonl`, `s7-{f0,f1}-capture.jsonl`, `score8.py` → `score8-s7.txt`, `s7-input-identity.txt`, `s7-evidence-pack.txt`)

**Exact candidate identities.** Both arms differ in the index set and in nothing else; the health endpoint confirms
the prompt hash on each.

| | F0 — pre-change v5 candidate | F1 — corrected |
|---|---|---|
| container name | `sail-assistant-py-f0` | `sail-assistant-py-f1` |
| container id | `45647f6ba64fe6d2114a25abb752c0bb8291e35d81f66e6f40522d16a25d4966` | `3d78d1e6efab926f7b67c884cc4cbea8f8ea88393d7437b988f35d6a4de982c1` |
| image | `sail-assistant-py:v6-r7` | `sail-assistant-py:v6-r7` |
| prompt | v5, `docsPromptSha=ff9ee87141ac1362` | v5, `docsPromptSha=ff9ee87141ac1362` |
| model | gpt-5.6-luna, `CHAT_TEMPERATURE=default` | same |
| routing / selection | `ASSISTANT_ROUTE_INTENT=on`, `ASSISTANT_HYBRID=rescue` | same |
| index set | `kb-pilot-c`, 916 chunks | **`kb-pilot-e`, 921 chunks** |
| port | 127.0.0.1:8034 | 127.0.0.1:8035 |
| capture | `~/central-assistant-py/s7-captures/f0` | `~/central-assistant-py/s7-captures/f1` |

`kb-pilot-e` was built from the **exact indexed source revisions**: a row-for-row copy of `kb-pilot-c`, then only
the changed sources re-indexed. Verified in the database — 0 chunk differences in every document that was not
changed, exactly three KB files differ, and 9 of the re-indexed chunks' vectors came from the stored-vector cache
(7 document + 2 KB) with 14 embedded. Nothing else was re-parsed or re-embedded.

**Totals, both rules reported separately.** Scored offline with judge .8 against the captured inputs
(`score8-s7.txt`); the rule each runner applies is named.

| suite | runner's rule | F0 | F1 | the other rule (F0 → F1) | first-source (F0 → F1) |
|---|---|---|---|---|---|
| routing 13 | all three | 13 | 13 | — | — |
| retrieval 18 | all three | 18 | 18 | — | — |
| frozen 12 | majority | 12 | 12 | all-three 11 → **12** | 33/36 → 33/36 |
| corrected claims 14 | majority | 13 | 13 | all-three 13 → 13 | 39/42 → **36/42** |
| work orders 8 | all three | **8** | **6** | majority 8 → 8 | 24/24 → 24/24 |
| manual coverage 57 | all three | **35** | **34** | majority 39 → 39 | 120/171 → 120/171 |
| fresh validation 10 | all three | 10 | 10 | majority 10 → 10 | — |

**Corrected-claims case 06 now passes on both arms**, which was the object of item 1: the answer is right, the
corrected section is cited but not first, and the citation is accepted because its text was supplied and supports
the answer. The first-source column carries the regression openly — 39/42 → 36/42, exactly the three runs of case
06. Nothing is hidden by the pass.

The only corrected-claims case failing anywhere is case 01 (Bulk Data Import job code), failing on all three runs
of **both** arms, on the answer check with `support=supported`. Unchanged by this work and equal on both arms.

**Attribution: which differences can be the change at all.** Of the 101 questions, **87 received byte-identical
supplied excerpts in both arms; 14 received different ones** — every one of them a work-order or office-generation
question, which is what restructuring that section should affect. On the 87 identical-input questions the two arms
disagree on **18 of 261 paired runs (6.9 %)**. [CORRECTED 19-Sep: this section first published 18/228 = 7.9 %.
The figure was read off an earlier partial run of the analysis that omitted the corrected-claims dump — 11 cases,
33 paired runs. `s7-input-identity.txt` always said 261; the brief and this paragraph did not. 87 identical-input
questions × 3 runs = 261.] That figure is the **observed pass/fail disagreement on identical supplied
excerpts** for this run. It is not an accuracy margin and it is not a reason to dismiss any individual failure; it
is used below only to say which differences *cannot* be attributed to the change.

| changed case | inputs | reading |
|---|---|---|
| frozen case 8 (gain, all-three) | identical | inside the identical-input disagreement set |
| manuals: `certsurveys-1`, `crewing-3`, `prep-2` (majority losses); `fs-ves-1`, `ra-office-3`, `ra-vessel-1` (majority gains); `master-review-1` (all-three loss) | identical, all seven | all seven appear individually in the identical-input disagreement list in `s7-input-identity.txt` |
| **work orders `wo-phr-01` and `wo-phr-05` (all-three losses)** | **different** | **real — examined below** |

**The two work-order losses, read against the full answers and the supplied excerpts**
(`wo-judge-defects-s7.txt`, full text in `s7-evidence-pack.txt`). Both are one failing run of three, so both pass
under the majority rule and fail under all-three. Both are **judge gaps, not answer defects**:

1. `wo-phr-01` run 1 — "Generate WO switch stated without the office qualifier". The requirement sentence in the
   per-job block *is* office-qualified: "in the **office**, the vessel's **office work-order generation** switch
   must be on." The block fails because of a second, correct sentence — "The Ship does not have this switch
   requirement." — which mentions "switch" without "office". The test requires every unit mentioning the word to
   be office-qualified and has no negation awareness (the base judge has had it since .5). Removing only that
   contrast sentence makes the test pass; the demonstration is in the file.
2. `wo-phr-05` run 3 — "Sail Admin wrongly attached to Generate WO". The check at `acceptance_wo.py:293` is a bare
   substring test. The only sentence in the per-job block containing "sail admin" says the restriction applies
   "only to the relevant planned-generation actions, **not** to per-job Generate WO or unplanned work orders" —
   the correct statement, and precisely the distinction the corrected document exists to make.

Both were found **after** the run, on the arm they would help. Neither was patched. They are reported for the
owner's decision, with the failing sentence quoted in each case.

A first diagnosis of mine was wrong and is recorded rather than dropped: I first attributed both to markdown
emphasis (the base judge strips `**`, the work-order judge does not). Re-running both answers with every `**`
removed fails identically, so that explanation is false. The two causes above are the tested ones.

**Confirmation that the complete qualification now reaches the model** (`chunking-before-after.txt`, from the
captured requests, not from the document):

- before (R4, arm E1): the section arrived in two pieces and the second ended `* Applies to all of the above: n`;
- after (R5, arm F1): the model receives `1.1.14.6.1 Office 'Generate Now' — a whole vessel` as one block carrying
  what it does, both conditions **and** the enforcement note in full, and `1.1.14.6` as a separate lead block.

**Runs marked for source-based review rather than scored on a guess: 23 runs carrying 46 flags** (two each), all
on runs that pass, all in the work-order suite. [CORRECTED 19-Sep: first published as "46 cases", which double
counted — it is 23 distinct runs across four cases. And the cause was **a defect in my own evidence tooling**, not
a case-definition weakness: the excerpt-header parser split the document name at the first em dash, and the KB
pilot filenames contain one, so every citation to a KB pilot file looked "not supplied". With the parser fixed
(judge .9) the count is **0**. See §18.3.]

### 17.6 Remaining defects

1. **Two work-order judge gaps** (§17.5): no negation awareness in the office-qualifier test, and a bare substring
   test for "sail admin" in the per-job block. Both demonstrated, neither patched.
2. **The work-order cases name their expected manual as "Technical"**, which resolves to 14 corpus documents. Under
   judge .8 those runs pass but are flagged for source-based review (46 flags). The cases should name the document
   they mean; that is a case change and was not made here.
3. **Corrected-claims case 01** fails on all three runs of both arms on the answer check, with the expected
   document supplied and supporting. Pre-existing, unchanged, equal on both arms.
4. **Corrected-claims case 04** expects the manual string "(Operational)", which names four documents; it passes
   now under exact identity plus supplied-text support, but the case should name its document.
5. **First-source ranking for case 06 is still behind the KB pilot file** (36/42 vs 39/42 on that suite). The
   restructure did not restore first place and was not intended to — the owner's instruction was explicitly not to
   shorten the document for ranking. Reported as a ranking fact, separate from the pass.
6. **The Audit History routing defect** is unchanged and still open.
7. **Observed pass/fail disagreement on identical supplied excerpts: 18 of 261 paired runs (6.9 %)** in this run
   (25 of 297, 8.4 %, in the previous one). Comparisons on these suites need paired identical-input analysis or
   many more repeats; single-run deltas are not evidence either way.

### 17.7 State of the environment

| what | state |
|---|---|
| live assistant (`sail-assistant-py-cand` :8017, `sail-assistant-py` :8015), nginx, SMS RAG, every other site | untouched; no configuration, route or credential changed |
| application authentication and permissions | unchanged; code read only |
| containers created | `sail-assistant-py-f0` (127.0.0.1:8034, `kb-pilot-c`) and `sail-assistant-py-f1` (127.0.0.1:8035, `kb-pilot-e`), loopback-bound, candidate-only |
| earlier containers (`…-b0`, `…-d5a`, `…-d5`, `…-e0`, `…-e1`, 8029–8033) | left running, untouched |
| container operations | every `docker run` / `docker rm` in this session named its container explicitly; no `--filter` was used to stop anything |
| index sets | `kb-pilot-e` created (921). `kb-pilot-c`, `kb-pilot-d` and every other set untouched |
| documents on the server | `documents/` untouched; R5 staged separately in `documents-r5/`, the reconciled KB files in `kb-r5/` |
| keys | the dedicated `assistant-luna.env` key was used for the 14 new embeddings and every answer; no key borrowed, moved, written to disk or printed |
| deployment | none |

## 18. Reviewer's third pass (19-Sep) — two arithmetic corrections accepted, one false failure corrected, one answer defect recorded, and a defect found in my own evidence tooling

The reviewer read the S7 pack and made five points. All five are accepted; two of them correct published
numbers, one overturns a conclusion of mine, and chasing a fourth uncovered a bug in my tooling that had
manufactured the "unresolved citation checks" entirely. No model calls were made in this round; live, nginx, SMS
RAG and every other site remain untouched and nothing is deployed.

### 18.1 The disagreement figure was misreported — 18 of 261 (6.9 %), not 18 of 228 (7.9 %)

The reviewer is right, and the evidence file was right all along: `s7-input-identity.txt` has said
`paired runs compared: 261` since it was written. §17.5, §17.6 and the brief quoted 228 / 7.9 %.

Cause, traced: I read the figure off an **earlier partial run** of the analysis, made while the corrected-claims
suite was still re-running, which passed four dumps instead of five. The missing suite is 14 cases, 11 of them
identical-input — 33 paired runs. 261 − 33 = 228. I never re-read the regenerated file before quoting it.
87 identical-input questions × 3 runs = **261**; disagreements **18**; **6.9 %**. Corrected in §17.5 and §17.6
in place, with the correction marked.

### 18.2 `wo-phr-01` F1 run 1 — false failure, corrected (work-order judge `.13`)

The reviewer ruled this a judge error, which matches the diagnosis: the per-job block says "in the **office**,
the vessel's **office work-order generation** switch must be on", and fails only because a second, correct
sentence — "The Ship does not have this switch requirement." — mentions the switch without "office". `.13` judges
only units that **assert** the condition; a mention inside a negated clause is skipped, which is the negation
awareness the base judge has had since `.5`.

### 18.3 `wo-phr-05` F1 run 3 — I was wrong; this is a genuine answer defect and it still fails

I reported this as a judge error only. **That was wrong.** The reviewer read the answer:

- in its own steps, for per-job 'Generate WO': *"In the Office, the vessel's **office work-order generation
  switch must be ON**."*
- in its conclusion: *"the office switch and Sail Admin restriction apply only to the relevant
  planned-generation actions, **not to per-job Generate WO** or unplanned work orders."*

The office switch **does** apply to per-job 'Generate WO'; only the Sail Admin restriction does not. The answer
requires the switch and then excludes it — a self-contradiction, and it must fail. The judge's *reason* was also
wrong (a bare "sail admin" substring test firing on a correctly negated sentence), so `.13` does both things: it
makes that test negation-aware, and it adds a test for the defect that is actually present
(`switch_applicability_contradiction`). The run stays FAIL, now for the true reason.

**Validation over all ten stored work-order dumps** (`wo-judge13-validation.txt`, `wo-judge13-resolution.txt`):
3 rule-level changes, 2 overall verdict changes —

| run | .12 | .13 | reading |
|---|---|---|---|
| s7 · wo-phr-01 · F1 r1 | fail | **PASS** | the false failure, corrected as ruled |
| s7 · wo-phr-05 · F1 r3 | fail | **fail** | verdict kept; reason replaced with the real contradiction |
| s4 · wo-generic-03 · D2-hybrid r3 | PASS | **fail** | the same self-contradiction on a historical arm, previously unnoticed |

`JUDGE_VERSION = 12` reproduces the previous scores exactly.

### 18.4 The 46 review flags were 23 runs — and they were a defect in my own tooling

Two corrections, one of them against me:

1. The reviewer is right that 46 flags = **23 distinct runs × 2 flags**, across four work-order cases. §17.5 said
   "46 cases", which double counted.
2. Chasing them produced the real finding. Building the per-run evidence pack showed the KB pilot file recorded
   as *"supplied to the model: no"* on a run whose answer plainly used it. The excerpt-header parser split
   `(<document> — <section>)` at the **first** em dash, and the KB pilot filenames contain one
   (`…: Office 'Generate Now' — generate a vessel's due work orders…`). Every citation to those files therefore
   looked unsupplied. Fixed in judge `.9`: the document is resolved against the corpus list first (longest match),
   falling back to the last separator. **With the parser fixed the unresolved count is 0** — the flags were mine,
   not the cases'. The "work-order cases name their manual as the bare string 'Technical'" item stays open as a
   case-quality point, but it was not what produced the flags.

### 18.5 What the citation check proves — now labelled honestly (judge `.9`)

The reviewer's substantive point: finding a required phrase in a supplied document does not prove that document
supports the answer's claims. Accepted. The support value is renamed `phrase-present` and is stated as
**necessary, not sufficient**; every citation pass resting on it alone is now reported as **PROVISIONAL** in its
own column, per suite and per arm. On this run that is every citation pass — frozen 36/36, corrected 42/42,
manual coverage 162/162, work orders 24/24 per arm. The fresh suite keeps its own citation check and is not
covered by this label.

### 18.6 The run, re-scored under judge `.9` + work-order `.13` (`score8-s7.txt`)

| suite | runner's rule | F0 | F1 | other rule (F0 → F1) | first-source | citation provisional |
|---|---|---|---|---|---|---|
| routing 13 | all three | 13 | 13 | — | — | — |
| retrieval 18 | all three | 18 | 18 | — | — | — |
| frozen 12 | majority | 12 | 12 | all-three 11 → **12** | 33/36 both | 36/36 both |
| corrected claims 14 | majority | 13 | 13 | all-three 13 → 13 | 39/42 → **36/42** | 42/42 both |
| work orders 8 | all three | **8** | **7** | majority 8 → 8 | 24/24 both | 24/24 both |
| manual coverage 57 | all three | **35** | **34** | majority 39 → 39 | 120/171 both | 162/162 both |
| fresh validation 10 | all three | 10 | 10 | majority 10 → 10 | — | — |

Work orders move from 6 to **7** of 8 on the corrected arm: `wo-phr-01` was a false failure and is now a pass;
`wo-phr-05` remains the single loss and is a **real answer defect**, not a scoring artefact. Everything else is
unchanged. Attribution is unchanged too: 87 of 101 questions had byte-identical supplied excerpts and the
**observed pass/fail disagreement on identical supplied excerpts is 18 of 261 paired runs**; all 18 sit in the
frozen and manual-coverage suites, none in the work-order suite.

### 18.7 What remains — and what the actual chatbot defect is

The reviewer asked what real chatbot fix is left once the tests stop moving. On this evidence:

1. **One genuine answer defect stands: `wo-phr-05` run 3's self-contradiction** — the answer requires the office
   switch for per-job 'Generate WO' and then denies it applies. One run of three; the other two are clean. The
   same contradiction appears once on a historical arm. Nothing has been changed to address it — it is an answer
   behaviour, not a test or a document problem, and it is the first item for any future prompt or content work.
2. Corrected-claims case 01 fails all three runs on **both** arms (answer check). Pre-existing, unchanged.
3. Case 06's first-source ranking is still behind the KB pilot file (36/42). Not addressed; the instruction was
   not to shorten the document for ranking.
4. Case 04's expected manual "(Operational)" names four documents; the work-order cases name theirs "Technical"
   (14 documents). Case-quality points, not patched.
5. The Audit History routing defect is unchanged and open.
6. Every citation pass is provisional in the sense of §18.5. Making it conclusive needs a claim-level check
   against the supplied text, which does not exist yet and is not built here.

Position unchanged: **keep live as it is.** Nothing deployed, nothing pushed.

## 19. The citation review, completed (19-Sep) — and the one targeted fix it points to

The reviewer's remaining task: finish the source-based citation review from the existing full answers and
captured excerpts, keep the switch contradiction as a real failure, propose **one** targeted fix afterwards
rather than expanding scoring rules, and keep the other open issues visible. No model calls in this round;
nothing deployed.

### 19.1 Method and totals (`claim_review.py` → `claim-review-s7.txt`, verdicts in `citation-review-verdicts-s7.md`)

Every stored answer is split into claims and each substantive claim scored by content-word coverage against the
single best-matching **supplied** excerpt. Lead-ins, navigation steps and statements *about* the sources are
reported separately rather than scored. Thresholds route attention; the verdict is the reading.

| | F1 corrected | F0 pre-change |
|---|---|---|
| substantive claims scored | 1,245 | 1,235 |
| supported by one excerpt (≥ 0.80) | 950 | 926 |
| partial (0.50–0.79) | 264 | 280 |
| flagged and read (< 0.50) | **31** | **29** |

A first run of this review flagged 59; 28 of them were list lead-ins ("You can filter by:") that my splitter had
scored as claims. That was fixed before the verdicts were written.

### 19.2 Verdicts on the 31 flagged claims

- **8 supported** — the metric under-scored them; the fact is in the supplied text verbatim. These are exactly
  the claims worth checking hardest: `JOB-XXXXXXX` as the generated job code, "not exceed 20 MB" for a combined
  upload, "5 MB per attachment", the "Doc 4.2.03" reference, "Save or Submittion is required for generating the
  Request no.", auto-sync on the ship, "the latest date wins; a same-date tie goes to the ship", and the
  Promotions 'All' sub-module opening by default. **No invented number, limit or identifier was found.**
- **20 cross-excerpt syntheses** — "this applies to both Ship and Office", "the sets are different…", "not a
  separate procedure for each section". In every case the components are present across two or more supplied
  excerpts; a single-excerpt score cannot represent them. Legitimate, with the limit stated: this shows the
  components were supplied, not that every comparison is logically sound.
- **3 UNSUPPORTED** — all three runs of `hist-1`, all one root cause (§19.3).

### 19.3 The only unsupported claims: the Audit History routing defect, and what it actually produces

`hist-1` asks who may add comments in the Review section of an **inspection history** record. The expected
source, `Audit - History Manual R1 p16` ("The Review section is intended for office users only"), **was never
supplied**: the known routing defect sends the question to Technical, and the three supplied documents are the
PMS Office manual, the Ship-Side notes and the Sync notes. The answer is built from the PMS **work-order** review
section — a different feature that also has a "Reviewer Comments" field — and converts a document audience label
("Audience: Office / Sail Admin") into a permission rule.

The answers are **correct by coincidence**. That is the finding worth carrying: this routing defect does not
merely fail to retrieve, it can produce a confident permission claim sourced from the wrong feature. All three
runs already fail on the citation check, so no score moves.

### 19.4 One targeted fix, proposed not applied (`PROPOSED-FIX-switch-scope.md`)

Tracing the switch/role conflation: the failing run's **supplied** text was correct — "the **Sail Admin
requirement** belongs to 'Generate Now' only" scopes the role alone, and the model widened it. But the corpus
contains a sentence that asserts the error outright, and **I wrote it** in this work — R5 §1.1.14.6.2: "**Both
refusals** belong to 'Generate Now' only." The switch refusal is not exclusive: the per-job route requires the
same switch and returns the same message when it is off.

The proposed fix is one change made at the two points that state the exclusivity — R5 §1.1.14.6.2 and the KB
exceptions line — so the switch's scope is explicit wherever the role's exclusivity is stated. No scoring rule
changes; the work-order contradiction test stays exactly as it is.

It is **not** established that this removes the contradiction: the failing run never saw the wrong sentence, so
this corrects a corpus error and a plausible contributing cause. Verifying it needs a re-index and a re-run of
the work-order suite — new model calls, not started, owner's approval required.

### 19.5 Everything else still open — `OPEN-ISSUES.md`

A register is now kept alongside the report: answer defects (the switch conflation; the Audit History routing
and what it produces; corrected-claims case 01; two chunks indexed but never retrieved), retrieval and ranking
(case 06 first-source), test-suite quality (cases naming 14 or 4 documents; every citation pass provisional; 264
partial claims not individually read) and measurement hygiene (the disagreement figure; the two corrected
numbers; my parser bug). **Live unchanged, promote nothing, v6 held.**

## 20. Reviewer's fourth pass (19-Sep) — corrected counts, the review extended, and the routing proposal

No model calls; nothing deployed, reindexed or changed in application authentication. Live, nginx, SMS RAG and
every other site untouched; v6 still held.

### 20.1 Corrections to §19's conclusions and counts (item 1)

- §19 and `citation-review-verdicts-s7.md` were titled "completed"; they were **screening plus a partial
  review**. Both are retitled and the file carries a correction header.
- "Three unsupported claims" → **"three unsupported claims identified among those reviewed"**. Unread claims
  are not verified.
- Section A: **8 grouped findings covering 9 occurrences** — `prep-3` contributes r2 and r3. Reconciled against
  the raw records: the 31 flagged F1 occurrences are 9 (Section A) + 20 (comparisons) + 2 (`hist-1` r1, r3).
  The third `hist-1` occurrence (r2) sat in the **partial** band and was folded into "3 unsupported" without
  having been flagged — stated now rather than left implicit.
- Every claim now carries a stable identifier `suite/case/arm/rRUN/cNN`, where `NN` is its position among all
  extracted sentences so the id does not move when classification changes. Occurrences and grouped findings are
  reported separately throughout (`review-ledger-s7.md`).

### 20.2 The splitter no longer excludes substantive claims (item 3)

`ledger.py` replaces `claim_review.py`. Nothing is dropped for being short or ending in a colon; a statement
about a source is reviewed when it asserts a fact; navigation is reviewed when it names a screen, module or
action, because choosing the wrong one changes the procedure. Only pure provenance boilerplate and bare
fragments are set aside, and both are counted.

Effect on the F1 population: 1,466 → **2,364 extracted sentences**, of which 1,854 are reviewable
(1,633 substantive + 172 navigation-critical + 49 source-factual).

### 20.3 What was reviewed, and what was not (items 2 and 4)

Review population, defined before reading (`ledger.py stats`): all low-coverage claims (149), all partial (428),
all high-coverage claims in the risk categories — permission, prerequisite, negation, number/limit, exclusivity
(528) — and a reproducible 20 % sample of the remaining high-coverage claims (150, seed 20260919). **Total
1,255 occurrences, 990 distinct.**

A deterministic engine (`verdicts.py`, rules stated in the file) triaged them:

| machine label | F1 occurrences |
|---|---|
| auto-supported (**not read, not verified**) | 495 |
| UNRESOLVED (engine cannot decide) | 631 |
| CHECK-COMPARISON | 82 |
| CHECK-PERMISSION | 25 |
| CHECK-NEGATION | 11 |
| CHECK-NUMBER | 5 |

**I read every CHECK-\* claim** — all 123 occurrences in the risk categories, which is where numbers, negation,
permissions, exclusivity and comparisons live — and recorded verdicts with the supporting or conflicting text
and its document, section and page (`review-ledger-s7.md`, `review-verdicts.json`): **73 supported, 6
supported-with-qualification, 4 unresolved, 3 unsupported, 1 contradicted** across both arms.

**I did not read the 631 UNRESOLVED or the 495 auto-supported claims.** They are reported as machine-labelled
and **not verified**. That is a shortfall against the instruction to review all 264 partial claims: the partial
band expanded to 428 occurrences under the wider splitter, and of those only the ones the engine surfaced into a
CHECK-\* category were read. Stated plainly rather than papered over.

**False acceptances found in the screening:** all five CHECK-NUMBER flags were engine artefacts, not answer
defects — the 20 MB sentence sits outside the top-3 passage window, and the number tokeniser split "4.2.03".
Conversely the engine's `auto-supported` rule was **not** validated against reading, so no claim is made for it.

**Comparisons, checked for same action, screen and environment** as instructed. `pmsoffice-5`: Office Dashboard
filter §1.1.3.2 p.9 **and** Vessel Reports filter §1.1.9.3 p.46 both supplied, same action — supported.
`pmsoffice-2`: "update spares by location" supplied from both environments (Vessel §1.1.7.3 p.39, Office
§1.1.7.4 p.45) — supported, with the note that the inventory-transaction sections came from the Vessel manual
only. `pmsoffice-4` "stated for both vessel and Office": the restriction is quoted from the Office manual; the
Vessel passage is supplied but does not carry it — **unresolved**, not assumed.

**Environment check that changed a verdict:** `ra-vessel-1` "the library is view-only for vessel users" was
flagged because the supplied text contains an Edit GRA row. Read: that row is from the **Office** RA manual §5
p.8, while the Vessel manual §4 p.7 — supplied in all three runs — says "available to vessel users for viewing
purposes only", and the answer cites the Vessel manual. **Supported**, correctly environment-scoped.

**F0 was reviewed to the same standard** for every finding used in the comparison; automated scores and read
verdicts are kept in separate columns of the ledger.

### 20.4 The switch contradiction stands (item 3, last clause)

`wo/wo-phr-05/F1/r3` is recorded as **contradicted** — correct steps earlier in the answer do not cancel the
contradictory conclusion. It remains a failure under work-order judge `.13`. A counter-example is recorded
alongside it: `generated/6/F1/r3` keeps the same two conditions apart correctly, so the defect is intermittent
phrasing rather than a uniform misunderstanding.

### 20.5 Audit History routing — traced and proposed (item 5, `ROUTING-PROPOSAL-audit-history.md`)

Traced end to end. `explicit_module()` returns `(None, "no module named")` — **proven offline against the real
corpus list**, and the cause is precise: `_GENERIC_TITLE_WORDS` contains `history` and `preparation`, so
`_terms_from_title()` yields **`[]`** for the Audit History and Audit Preparation manuals. Those two documents
contribute no routing term at all and cannot be reached by name. With no named module the decision is pure
vector similarity over generic wording ("review", "comments", "ship", "office"), Technical wins at distance
0.8754 with margin 0.1266 — above the 0.07 clarify threshold — and no Audit chunk is inside the 1.15 floor, so
`audit` is never even a candidate. This also predicts the separately known `prep-*` retrieval failures.

One correction proposed, with code locations, precedence rules (explicit name > originating-module context >
vector), a two-stage verification plan whose first stage is offline over all 102 stored questions, and an
explicit falsification condition. It does **not** hardcode the question and does **not** infer permissions from
an audience label — that is an answer behaviour, listed separately. **Not implemented.**

### 20.6 Document error kept separate from model error (item 6, `DOC-ERROR-both-refusals.md`)

The R5 sentence "Both refusals belong to 'Generate Now' only" is wrong — only the role refusal is exclusive; the
switch applies to per-job 'Generate WO' too. The correction is recorded with a text diff for later candidate
work. **The failing answer never received that sentence**, so correcting it is **not** claimed to fix the
observed contradiction; the causal link is not established.

## 21. Reviewer's fifth pass (19-Sep) — the count overstatement corrected, review finished, routing split in two

No model calls; nothing deployed or reindexed; live, nginx, SMS RAG and every other site untouched; v6 held.

### 21.1 The count was overstated — corrected (item 1)

§20.3 said "I read every CHECK-\* claim — all 123 occurrences". **That was false.** Verified against the JSON:
117 verdicts were recorded in total (73 F1 + 44 F0), and F1 alone left **56** CHECK-\* claims unread
(47 comparison, 7 permission, 2 negation). The overstatement came from describing the outcome of a
regex-driven verdict table as though it covered every claim in the category; the table matched only the
patterns I had written.

**After finishing the work this round:** F1 **122 of 123** CHECK-\* read (1 unread), F0 **109 of 112**
(3 unread). Total recorded verdicts **277**. Every remaining unread claim is named individually in
`review-ledger-s7.md`.

### 21.2 Two review decisions corrected (item 2)

- **`sms-office-1`** — the reviewer spotted a verdict whose note contradicted the claim. Cause: my `XREF`
  auto-rule matched "same as" **inside a negation** ("the manual does **not** state that its approval steps are
  the same as Section 4.1.2") and attached the note "restates the manual's own cross-reference; the target is
  supplied". Checked the full supplied text: no "4.2.2", no "same as 4.1.2", no "refer to 4.1" — the answer's
  limitation is **accurate**. Verdict stays supported, the reason is replaced, and the rule is now
  negation-aware. Same class of bug as the work-order judge's, in my own tooling.
- **`pmsoffice-5`** — my note said the two passages share the "same action (apply filter)". They do not: Office
  **Dashboard** filter §1.1.3.2 p.9 versus Vessel **Reports** filter §1.1.9.3 p.46 differ in **both screen and
  environment**, so the comparison cannot attribute the difference to either. Downgraded to
  **supported-with-qualification**, with the explicit note that any claim generalising to "the two Dashboard
  screens differ" is **not** established.

### 21.3 Review finished in batches — and two new findings on the pre-change arm

Batches 2 and 3 cleared the outstanding CHECK-\* claims. Verdicts now: **232 supported, 21
supported-with-qualification, 14 unresolved, 9 unsupported, 1 contradicted.**

Two **new unsupported** claims, both on F0 and both the same shape as the `hist-1` audience-label error — a
marker or a related form turned into a rule:

| claim | why unsupported |
|---|---|
| `certsurveys-2` "the record cannot be saved while a mandatory (\*) field is blank" | the supplied text carries a "Mandatory field" marker and a save-icon callout, but **no** statement that saving is blocked. Searched for "cannot be saved", "not be saved", "required fields" — none present |
| `fn-2` "the same recording steps are also documented for a Lesson Learnt" | **"Lesson Learnt" does not appear anywhere** in the supplied excerpts for that question |

Also resolved: `generated/4` "the sequence continues across both numbering formats" → **unresolved**, an
inference the supplied text does not carry.

### 21.4 Wording corrected (item 4)

"Only the unplanned route is exempt from the switch" was too broad — ship-side per-job generation does not
require the office switch either. Both `DOC-ERROR-both-refusals.md` and `PROPOSED-FIX-switch-scope.md` now read:
**"On the office instance BOTH 'Generate Now' and per-job 'Generate WO' require the switch; unplanned creation
does not. On a ship instance neither route requires it."**

### 21.5 Routing split into two independently testable changes (item 3, `ROUTING-PROPOSAL-v2-two-changes.md`)

**"Root cause proven" was too strong and is withdrawn.** What is proven, offline and reproducibly, is a
**recognition gap**: `_GENERIC_TITLE_WORDS` contains `history` and `preparation`, `_terms_from_title()` returns
`[]` for both Audit manuals, and `explicit_module()` returns `(None, "no module named")`. Between that gap and
the wrong answer sit the vector ranking, the floor, the clarify margin and the answer model — that chain is
**not** established.

- **Change A (recognition):** module-qualified title phrases (`audit history`), never the bare word — because
  "history" is unique among titles but **not** unambiguous in a user's question ("running-hours history" is
  Technical). Test A is offline over all 102 stored questions plus two false-positive probes; Change A stands or
  falls on its own.
- **Change B (clarification guard):** accepted that it can reject valid paraphrases. It must therefore be
  measured on **three** outcomes — correct-from-right-module, clarify, wrong-module answer — never two.
  "`hist-1` is no longer wrong" is not a result; whether it became *correct* or merely *clarified* is the result,
  along with how many previously-correct questions became clarifications.

`routing-evidence/` now ships the routing code, the title-term proof and the complete captured input for
`hist-1`, so the claim can be checked without repository access — the reviewer could not verify it from the
previous pack.

## 22. Reviewer's sixth pass (19-Sep) — counts confirmed, two of my findings retracted, routing proposal rebuilt

No model calls; nothing deployed or reindexed; live untouched; v6 held; the clarification guard stays on hold.

### 22.1 Counts (item 1)

Confirmed: **277 = 150 F1 + 127 F0**, including the reported 122/123 and 109/112 risk claims. After this round
the four outstanding risk claims are read: **F1 123/123, F0 112/112, 281 verdicts recorded.** The wider review
remains incomplete — **1,203 machine-UNRESOLVED and 983 machine-`auto-supported` occurrences across both arms
are still unread and are not verified** (open item C4). The ledger now states coverage before any result.

### 22.2 Change A withdrawn — my proposal contradicted itself (item 2)

The reviewer ran the supplied functions. Reproduced here (`routing-evidence/R1-R2-reproduction.txt`):
`"audit history"` and `"audit preparation"` already resolve to Audit **through the existing `audit` alias**, so
the title phrases add nothing; and the reported question says "**inspection** history", names no module, and
returns `(None, 'no module named')`. v2 acknowledged that limitation and then set a pass condition requiring
that same question to resolve to `audit` — **unsatisfiable, and self-contradictory.** Change A is withdrawn as
a fix for `hist-1`.

### 22.3 The two executable routing findings (item 3, `ROUTING-PROPOSAL-v3.md`)

- **R1 — ambiguous title terms are not dropped.** The comment promises they are; the code keeps whichever
  module appears first. Reproduced with a synthetic collision: reversing document order flips the mapping.
  **Measured as latent** — a scan of the real corpus finds **no** currently ambiguous term, so R1 causes no
  misroute today. Worth fixing, but not the cause of anything observed.
- **R2 — a named module is honoured only if it is already a candidate.** `if named and named in best` discards
  an explicitly named module that has no chunk inside the 1.15 floor, and vector routing then answers from a
  different module. The code path is proven; **whether it fires on any current question is not yet measured**,
  and that offline test is named and outstanding.
- **Neither addresses `hist-1`**, which names no module. That remains a recall problem, and the guard stays on
  hold.

"Root cause proven" is withdrawn entirely. The recognition gap is proven; it is not the cause of `hist-1`.

### 22.4 The comparison correction now applies to both arms (item 4)

The six F1 `pmsoffice-5` entries had kept the old "same action" explanation because an earlier row in my
verdict table matched first. Fixed: all ten occurrences across both arms now read
**supported-with-qualification**, with the distinction the reviewer asked for — **valid** as a comparison of two
*different* screens, which is what the question asks; **not** valid as a claim about equivalent screens, since
the two passages differ in both screen and environment.

### 22.5 Two of my findings retracted (item 5 and the closing caution)

Both "new unsupported claims" I reported last round were **wrong**, and for the same reason: I searched the
excerpt **bodies** only, and for one phrasing rather than the meaning.

| claim | what I said | what the text says |
|---|---|---|
| `certsurveys-2` "if mandatory fields are blank, the record cannot be saved" | unsupported | the supplied text reads **"Mandatory fields (\*) must be completed before the record can be saved"** — the claim is its contrapositive. **Supported.** |
| `fn-2` "the same recording steps are documented for a Lesson Learnt" | unsupported | the **Lesson Learnt User Manual p.7 §2 Discussion Record was supplied** as excerpt 2 and is cited. The words appear in the excerpt header, which my search excluded. **Supported.** |

The search now covers document and section headers as well as body text. This is the **third** false finding
produced by my own tooling in this workstream, after the em-dash header parser and the negated-`XREF` rule —
recorded as a pattern, not as three unrelated slips.

**`hist-1` framing corrected.** I wrote that the permission was "inferred from an audience label". The capture
shows the supplied text also states plainly: *"The user interface shown in Ref. Figures 12, 13, 14 and 15 are
applicable to the **Office** side."* The Office attribution is therefore locally supported. The defect is that
it is the **wrong feature** — PMS work-order review, not inspection-history review. The verdict stays
unsupported; the reason is corrected.

### 22.6 Where this leaves the count of real answer defects

| defect | status |
|---|---|
| `wo-phr-05` switch contradiction | stands, **contradicted**, one occurrence |
| `hist-1` wrong-feature answer | stands, **unsupported**, correct by coincidence, framing corrected |
| `certsurveys-2`, `fn-2` | **retracted — both supported** |

Two real answer defects, not four. Live stays as it is; promote nothing.
