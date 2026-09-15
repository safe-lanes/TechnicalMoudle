# Brief for review — prompt v5 and the gpt-5.6-luna candidate (15-Sep-2026)

Scope of this brief: the answer-generation experiment that followed the reviewer's plan (judge fixed first, v5 prompt replayed on captured inputs, then an alternative model on the same inputs, then the suites). Live is unchanged (prompt v2, gpt-4o-mini, borrowed key, index `repaired` 911). Nothing is deployed. Full detail and every earlier step: `REPORT.md` §8–§13.

## 1. What was tested, in order

| step | what | result | evidence |
|---|---|---|---|
| Judge .7 | format-aware parsing only (all source lines stripped, method-block scopes, heading held for the next action); acceptance requirements unchanged | validated on 132 stored answers: 0 changes on the 120 pre-v4 answers, 5 v4 verdicts corrected and verified by reading | `judge7-validation.txt` |
| Judge .8 | owner rule: an Office label governing an entire procedure qualifies its conditions; a label attached only to vessel selection cannot | validated on 144 stored answers: exactly the 3 intended changes | `judge8-validation.txt` |
| Prompt v5 on gpt-4o-mini | replay on the exact captured five-excerpt contexts, T=0.2 | coverage 6/6, 0 invented references, but per-job switch missing 2/6 and never explicitly office-qualified → did not pass | `prompt5-analysis.txt`, `prompt5-capture.jsonl` |
| Prompt v5 on gpt-5.6-luna | same contexts, same prompt, default temperature (the model rejects 0.2), new dedicated key | **passed 6/6** by judge .8 and by reading | `luna-analysis.txt`, `luna-capture.jsonl` |
| Suites on a candidate service | prompt v5 + gpt-5.6-luna (8020) vs prompt v2 + gpt-4o-mini (8018), index `kb-pilot` 916 both | no regression; work-order phrasings 1/8 → 4/8 judge, 6/8 by reading | `luna-runs.txt`, `luna-*-dump.jsonl` |

## 2. The v5 prompt (docs path, verbatim; sha256[:16] `ff9ee87141ac1362`)

> You are the SAIL Maritime PMS assistant. Answer the user's question using ONLY the manual excerpts provided. Rules: if the excerpts do not answer the question, say plainly that it is not covered in the Technical documentation — never guess. HARD RULE — cross-references: the manuals often say 'Refer to the <other> sub-module and apply the same steps'. When an excerpt contains '(Cross-reference resolved: the steps for A are the same as section X …, page N. They are:)' followed by steps, then the question about A IS covered: answer with those steps, and state that they are the same as section X (page N). Never answer 'not covered' when such a resolved cross-reference is present. That 'same as section X' statement is made ONLY when an excerpt itself contains that resolved cross-reference text; a plain pointer such as 'Details: <file>' or 'see section X' is a link, not evidence that two procedures share the same steps — never write '(Cross-reference resolved: …)' or 'the steps are the same as …' on your own. RULE — coverage: if the question is broad (it names no single method, form or button), first list briefly every method the excerpts support for it — including methods described separately inside an overview excerpt — then explain each one; never answer with one method as if it were the only one. If the question names a method, answer that method and note the other supported methods in one line. RULE — conditions: explain each method as plain numbered steps with its requirements written directly next to that method — role, Office or Ship applicability, switches or settings, record state — exactly as the excerpt describing that method states them; state Office/Ship differences wherever the source makes them; never present a conditional action as unconditional, never attach a condition to a different action, and never drop a condition because another excerpt about the same action does not mention it — an omission in one source is not a contradiction. RULE — sources: excerpts may be published manuals or draft code-derived guidance (marked as such, or citing application code or a repository revision); neither automatically overrides the other; where two excerpts actually conflict, state both and name each source; where an excerpt is marked draft, unverified or revision-specific, say so in one clause. Keep it short and plain; do not use 'Method' / 'Applies to' / 'Requirements' labels. End with ONE "Source:" list naming, for each method, the manual or guidance and section that supports it.

Changes from v2: the two "not covered" and cross-reference sentences are v2 verbatim; the sentence restricting the cross-reference statement, the coverage rule, the conditions rule, the sources rule and the no-labels / one-source-list instruction are new. v3 (conditions rule only) and v4 (labelled per-method format) are superseded. The tool-loop instructions carry the same rules in compact form (sha `7a028346c1c2fdf0`).

## 3. Environment of the model comparison (PROVEN from the captured request bodies)

| item | value |
|---|---|
| container / image | `sail-assistant-py-exp2`, image `sha256:8db669090d36…` (prompt-v2 image; the system text is supplied per call in the replays) |
| contexts | the two NORMAL-arm user messages captured in §9, replayed byte-for-byte: `ef40f46331cd52c8` (6,417 chars, "How do I create a work order?"), `57816b0740f3a644` (5,095 chars, "What are the different ways to create a work order in PMS?"); five excerpts each, no consolidation |
| gpt-4o-mini arm | `temperature 0.2`, timeout 30 s |
| gpt-5.6-luna arm | **no temperature parameter** (400 "only the default (1) value is supported" otherwise), timeout 30 s; key = the new dedicated project key (scoped to gpt-5.6-luna + text-embedding-3-large; gpt-4o-mini returns 403 on it) |
| capture | `ASSISTANT_CAPTURE_OUTBOUND` on the diagnostic process only; request bodies only; scanned (0 keys / tokens / identity names); deleted from the server after copying |
| price used for cost | gpt-5.6-luna $0.20 per 1M input, $1.20 per 1M output — READ from OpenAI's model page and OpenRouter via web search, not verified against billing |

## 4. Replay results on the captured contexts (3 runs per question)

| criterion | v2 + gpt-4o-mini | v5 + gpt-4o-mini | v5 + gpt-5.6-luna |
|---|---|---|---|
| all four methods (planned-automatic, office Generate Now, per-job Generate WO, unplanned) | 3/6 | 6/6 | **6/6** |
| invented cross-reference statements | 0 | 0 | **0** |
| Generate Now with Sail Admin + switch, in the office | 3/6 | 6/6 | **6/6** |
| per-job switch present | 0/3 where applicable | 4/6 | **6/6** |
| per-job switch explicitly an office condition | — | 0/6 strict (4/6 by whole-procedure label, judge .8) | **6/6** ("in the office the vessel's office work-order generation switch must be ON") |
| Office/Ship applicability stated where the source makes it | partial | unplanned narrowed to Office 3/6 | **6/6** (e.g. "The vessel-specific instructions do not include this selection step") |
| unsupported claims | 0 | 1 ("without any prerequisites") | **0** ("normal sign-in and vessel access are required", the overview's wording) |
| citations supported | yes | yes | yes, per method |
| judge .8 | 0/6 | 3/6 | **6/6** |
| latency | 2–4.4 s | 3.3–4.4 s | 6.5–11.0 s |

The v5 + gpt-4o-mini per-run reading under the owner's Office-label rule is in `REPORT.md` §12.3a (missing condition 2, ambiguous applicability 6, unsupported claim 1, judge-only 3 under .7 / 0 under .8).

## 5. Suite results — candidate vs baseline, same index `kb-pilot` 916

| suite | A: v2 + gpt-4o-mini | B: v5 + gpt-5.6-luna (judge) | B by reading |
|---|---|---|---|
| retrieval 18 (expectations v1 and v2) | 18/18 | 18/18 | same distances |
| frozen 12 (.3), joint of 3 runs | 11/12 | 11/12 | case 05 fails on both (routing clarify gate, unchanged) |
| case 09 cross-reference attribution | 3/3 | 3/3 | attribution kept |
| corrected claims 14 (.2) | 12/14 | 12/14 | 13/14 (gen-01: "the system generates a code" vs the judge's literal "generated"; gen-04 known test-string defect on both) |
| work-order phrasings 8 (.8), all runs required | 1/8 | 4/8 | 6/8 |

Work-order phrasings, candidate, every failing run read against the overview and manual p.29:

| case | judge | reading | classification |
|---|---|---|---|
| wo-generic-01 How do I create a work order? | 2/3 | 3/3 | judge-only — a blank line between the heading and its requirements bullets makes .8 attach them to the previous action |
| wo-generic-03 How to create work order in PMS? | 0/3 | 0/3 | retrieval — no overview among the five excerpts; the answer says so correctly |
| wo-phr-02 raise a work order for a pump | 0/3 | 0/3 | retrieval — no excerpt states another way; the unplanned answer is correct with an explicit Office/Ship split |
| wo-phr-05 how do work orders get created | 2/3 | 3/3 | judge-only — the raw-scope "sail admin" check catches the manual file name "…For Office_Sail Admin…" inside a per-method source bullet; one wording slip ("four ways" then three listed) |
| wo-generic-02, wo-phr-01, wo-phr-03, wo-phr-04 | 3/3 each | 3/3 | pass |

Actual usage of the candidate over the suites (conversation log; usage recording fixed on the branch — see §7): 99 answers, 153,300 prompt / 38,939 completion tokens, ≈ $0.077 at the list price; latency mean 5.3 s, max 10.5 s (gpt-4o-mini: 2.5 s / 7.0 s).

## 5a. Corrections after the reviewer's check (15-Sep) — REPORT §13.4a

1. "No unsupported claims" withdrawn: replay generic run 3 contradicts itself on whether the June manuals describe the per-job path (they do, p.18; the excerpt-level statement should have said "not in these excerpts"); replay generic run 2 has a garbled source-comparison sentence. Corrected count: conditions and coverage 6/6, unsupported or inconsistent statements 2/6 (both in the source-comparison sentence).
2. Retrieval distances: 17/18 identical; "raise a lesson learnt" 1.0129 vs 1.0145 (question-embedding variation, ranking unchanged). Corrected-suite equal totals hide a loss on gen-01 (B 0/3, word-match on "generated" vs "generates"; full answers quoted in §13.4a and in `luna-generated-dump.jsonl`) and a gain on gen-13.
3. Pump phrasing: the candidate assumes unplanned work ("To raise a work order for the pump, create an unplanned work order") — now classified as a real answer defect (unsupported assumption) in addition to the retrieval miss.
4. The tested package includes the five KB files; switching only model + prompt on the live index is untested, and the provenance line has not reached the model yet.
5. "$0.00000" relabelled "usage UNAVAILABLE — the call was not free" in `luna-analysis.txt`.

Judge .9 (parsing only): requirements block after a held heading travels with it; quoted manual file names ignored by the Sail-Admin check. Validated on 192 stored answers — exactly the two intended verdicts change. Candidate work-order score under .9: 6/8.

## 6. Open judge items (reported, not changed)

1. Requirements bullets separated from their heading by a blank line are attributed to the previous action (.8 block parser).
2. The "Sail Admin wrongly attached to Generate WO" check reads the raw scope; a manual file name inside a per-method source bullet triggers it (the file-name exclusion applies only to the negation check).
3. The judge does not detect an unplanned procedure framed as office-only, nor a "no prerequisites" claim — both remain manual criteria.
4. The corrected-claims judge requires the literal "generated"; "generates" fails.

## 7. Two service-code changes (branch only, live image unchanged)

- `CHAT_TEMPERATURE` setting: "0.2" (served default) or "default" = no temperature sent; `/health` reports `chatModel` and `temperature`.
- Usage bug: pydantic-ai 2.42 exposes `AgentRunResult.usage` as a property; the service called it as a method, swallowed the error and logged `tokens_in/out = None` for every conversation since the port. Fixed; telemetry only.

## 7a. Reviewer's next direction — plan, not started (REPORT §13.6)

- Retrieval misses (wo-generic-03 overview outside the top 8; wo-phr-02 overview at rank 8): options are a hybrid lexical boost using the existing unused `tsvector` column (recommended, smallest change able to reach both), one-excerpt-per-section with refill (reaches only the pump phrasing), or the reranker step. Owner decision.
- Provenance notice: build `kb-pilot-prov` (five KB chunks re-embedded with the "draft code-derived guidance … revision cf5241ad6; running deployment unverified" line), confirm by capture that it reaches the model, run the suites (~$0.08).
- Deployment package: run the full suites on exactly the package the owner chooses — model + prompt + key on `repaired` 911, or the same plus the KB files with the notice — before any promotion. Neither has been tested yet.

## 8. Decision points for the owner (not taken)

- Promotion would move live to the dedicated key and therefore to gpt-5.6-luna (the key cannot serve gpt-4o-mini), with `CHAT_TEMPERATURE=default`, prompt v5, and retirement of the borrowed key.
- The suites ran on `kb-pilot` (the five KB files included). Promoting model + prompt without the KB files needs one confirming run on `repaired` 911; promoting the KB files is a separate decision (their provenance line, §10.4, is prepared but not applied).
- The two retrieval misses (wo-generic-03, wo-phr-02) are outside any answer-model change.

## 10. Owner brief of 15-Sep, steps 1–6 — done, nothing deployed (REPORT §14; supersedes §7a–§8 above)

- Step 1: owner confirmation recorded (running Technical app = inspected revision cf5241ad6); "running deployment unverified" removed; provenance line reworded and inside each KB chunk (after the title, one chunk per file).
- Step 2 (A manuals only 855 / B + corrected docs 911 / C + KB files 916; same Luna, v5, settings; 0 embedding calls for manuals): frozen 11/12 on all; corrected 2 → 11 → 11 of 14 (A: 33/36 honest "not covered" runs, 0 fabrications); work-order 0 → 0 → 6 of 8; retrieval 16 (two code-derived expectations absent by construction) → 18 → 18.
- Step 3: judges corrected on stored answers, old results kept (base .4 markdown normalisation: 9 runs; WO .10/.11 negation and source-sentence handling: 4 verdicts). New manual-coverage suite: 57 source-backed cases over all 20 manuals, support checked in the captured excerpts; A 51/57 and C 55/57 correct by reading, 0 wrong statements; real defects = two routing, one chunk gap, one model, two partials.
- Step 4/5, measured separately on one image and index: routing (explicit module or manual name from the corpus titles; context only breaks a clarify tie; identity/tenant/vessel untouched) C0 8 → D1 11 of 13 probes, frozen case 05 resolved in all context variants, no losses. Excerpt selection: convex fusion r5 (D2) reached 13/13 and WO 8/8 but lost a frozen chunk, reordered citations, moved three corrected citations to KB files and cut manual coverage 24 → 16 — cause measured (lexical top-10 truncation scored as 0; lexical scale dominates). α 0.7 (D3) no better. Embedding-only comparison of four variants on 104 questions → r6 "lexical rescue" (served five kept, lexical leader in the last slot when absent; 95 % of served excerpts kept).
- Step 6, package D4 = image `sail-assistant-py:prompt-v5-r6` 58d02521e6ae, gpt-5.6-luna default temperature, v5 `ff9ee87141ac1362`, kb-pilot-c 916, routing on + rescue: routing 13/13 · retrieval 18/18 · frozen 11/12 (12 by reading) · corrected 12/14 (13 by reading) · work-order 7/8 (8 by reading, one judge scope gap) · manual-coverage 18/57 automatic vs D1 24 — one retrieval-level loss (master-review-2), one ambiguous, five identical-input variance cases. 1,554 / 301 tokens per answer, ≈ $0.67 per 1,000 questions, latency 4.7 s mean / 9.4 s p95 under concurrency. Remaining limitations and judge gaps: REPORT §14.8.

## 9. Files

Core: `ASTRA-BRIEF-v5-luna.md` (this), `REPORT.md` §12–§14, `luna-analysis.txt`, `luna-capture.jsonl`, `luna-runs.txt`, `luna-wo-dump.jsonl`; step 4–6 evidence `s4-runs.txt`, `s4b-runs.txt`, `s4c-runs.txt`, `s4*-dump.jsonl`, `s4-*-capture.jsonl`, `lexdiag3.txt`, `selectdiag.txt/.json`, `s4c-manuals-rejudge.txt`, `usage.py`, `convlog-s4.jsonl`.
Supporting: `prompt5-analysis.txt`, `prompt5-capture.jsonl`, `judge7-validation.txt`, `judge8-validation.txt`, `luna-answers-dump.jsonl`, `luna-generated-dump.jsonl`, `diag_prompt.py`, `run-luna-suites.sh`, `central-assistant-py/indexer/acceptance_wo.py` (judge versions 3–8).
