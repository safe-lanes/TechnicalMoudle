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

Screenshot method: no OCR engine exists on the build machine. The callout text on the screenshots is present in the PDFs' own text layer (text boxes over the images), so every `[screenshot:]` callout quotation came from the text layer; the rendered page image was read only for the 'Generate Work Order' pop-up option labels (p.18) and the unplanned form layout (p.29). Nothing was transcribed from an unreadable image.

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

## 6. Guesses (not findings)

- None of the results above are inferred; all come from the runs. One `[unverified]` remains in unplanned-wo.md (whether the running-hours completion check applies to the unplanned form's Part B submission) — not traced.
- Interpretation, not measured: an overview/index procedure ("ways to create a work order") or a retrieval change (duplicate Office/Vessel collapse, or grouping chunks by procedure) would be the next candidates for the generic phrasing. Not tested, not proposed as fact.
