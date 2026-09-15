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

- None of the results above are inferred; all come from the runs. One `[unverified]` remains in unplanned-wo.md (whether the running-hours completion check applies to the unplanned form's Part B submission) — not traced.
- Interpretation, not measured: an overview/index procedure ("ways to create a work order") or a retrieval change (duplicate Office/Vessel collapse, or grouping chunks by procedure) would be the next candidates for the generic phrasing. Not tested, not proposed as fact.
