# Reviewer brief — owner brief of 15-Sep-2026, steps 1–6 (candidate only; nothing deployed)

Self-contained for a reviewer with no repository access. Everything below is measured on candidate containers on the test server. The live assistant, nginx, the SMS RAG service, other sites and all shared credentials were untouched, and no shared key was revoked. Full detail: `docs/assistant-experiments/2026-09-15-kb-pilot/REPORT.md` §14.1–§14.8.

Evidence classes used throughout: **PROVEN** = measured, output stored; **READ** = concluded from reading code or text; **INFERRED** = deduction.

---

## 0. The system under test

| item | value |
|---|---|
| service | FastAPI + Pydantic AI, own Postgres with pgvector; docs path = one embedding → 10 nearest chunks → module routing → ≤5 excerpts → answer model |
| answer model | `gpt-5.6-luna`, default temperature (the model rejects an explicit temperature) |
| embedding model | `text-embedding-3-large`, 3072 dims, one call per question |
| prompt | `v5-plain-coverage-2026-09-15`; docs sha `ff9ee87141ac1362`, tool-loop sha `7a028346c1c2fdf0`, combined `aea94e2f5edb6948` |
| retrieval settings | distance floor 1.15 · routing margin 0.07 · top_k 10 · 5 excerpts (unchanged since the original Chroma calibration; squared L2) |
| key | a dedicated assistant key scoped to those two models only |
| live service (unchanged) | index `repaired` 911 chunks, prompt v2, gpt-4o-mini, borrowed key |

Suites (all pre-existing unless marked new): **retrieval-18** (top-1 source per query, no answer model) · **frozen-12** (answers frozen 14-Sep, each verified against the manual) · **corrected-claims-14** (claims that exist only in the code-derived documents) · **work-order-8** (8 phrasings of the creation question) · **manual-coverage-57 (new)** · **routing-13 (new, routeOnly, embeddings only)**. Answer suites run ×3 and a case passes only if all three runs pass.

---

## 1. Step 1 — owner clarification recorded

The owner confirmed that the running Technical application and the inspected code are the same, at repository revision `cf5241ad6`. Recorded as the owner's confirmation, explicitly **not** as an independently measured deployment check. The blanket "running deployment unverified" statement was removed everywhere. The provenance line now embedded in each knowledge-base chunk reads, in part: draft code-derived guidance, not a published manual, inspected at revision cf5241ad6, which the application owner has confirmed is the code running in the application; where this guidance and a manual differ, say which source says what.

Kept unchanged: the `[code: …]` / `[manual: …]` distinction, every source reference, the review status of each file, and the conflict log recording six specific code-versus-manual differences rather than silently choosing one.

## 2. Step 2 — three source sets

Built with **zero** embedding calls for manual content: the 20 official PDFs hash-match the server corpus byte for byte, saved parses were reused, and the 855 manual vectors were copied from the existing index.

| set | index | contents |
|---|---|---|
| **A** manuals only | `manuals-only`, 855 chunks, 20 documents | the 20 official manuals, with the verified extraction repairs and resolved cross-references |
| **B** + corrected code-derived docs | `kb-base`, 911 chunks, 25 documents | A + five corrected code-derived Technical documents (Bulk Data Import, Recent Updates, Roles & Permissions, Ship-Side notes, Sync) |
| **C** + work-order pilot files | `kb-pilot-c`, 916 chunks, 30 documents | B + five one-chunk work-order knowledge files, each carrying the provenance line after its title |

The five corrected documents and the five pilot files are different artefacts and are listed separately with their own hashes in REPORT §14.2.

### Results (PROVEN)

| suite | A manuals only | B + corrected docs | C + pilot files |
|---|---|---|---|
| retrieval-18 | 16/18 — the two misses expect a code-derived document that A does not contain, so absent by construction, not a ranking fault | 18/18 | 18/18 |
| frozen-12 | 11/12 | 11/12 | 11/12 — identical case by case |
| corrected-claims-14 | the 2 cases whose evidence is in an official manual pass 3/3; **33 of 36 runs on code-derived-only claims state honestly that the excerpts do not cover it**; the other 3 answer faithfully from the manual's own sync section | 11/14 | 11/14 |
| work-order-8 | **0/8** — every answer gives only the manuals' unplanned procedure, which is correct for what the manuals say and incomplete for the product | 0/8 | **6/8** |

What this establishes: from the official manuals alone the model answers every frozen case the richer sets answer, and it states an honest limitation where the evidence is absent. **No fabricated code-derived claim appeared in any set.** The corrected documents add exactly the code-derived claims; the pilot files add the work-order coverage.

## 3. Step 3 — verifying the actual sources of answers

**New suite: manual-coverage-57.** 57 source-backed cases spanning all 20 official manuals — 12 ordinary procedures, 20 conditions, 8 tables, 7 screenshot instructions, 10 cross-references. Every required phrase and page was verified against the chunk text before the case was written. For every run, the request body actually sent to the model was captured, and support is scored against those captured excerpts. A filename in a citation, or a keyword match, never counts as support.

**Automatic scores (answer ∧ citation ∧ support, all 3 runs):** A 22/57 · B 20/57 · C 24/57.

**Sources used**, from citations and captured excerpts: A = 165 of 171 runs manual-only (6 with no citation); C = 162 manual, 3 code-derived + manual, 3 pilot + manual, 3 none. The additional sources appear in at most 6 of 171 runs and never alone.

**Reading every failing case against the manual text** (six labels; done independently for A and C):

| label | A (35 failing) | C (33 failing) |
|---|---|---|
| correct paraphrase, judge failed a literal phrase or word order | 28 | 30 |
| correct, cited page adjacent to the expected one | 1 | 1 |
| partial — a step or comparator missing | 2 | 0 |
| honest limitation although the manual holds it | 4 | 1 |
| wrong source | 0 | 1 |
| **wrong statement** | **0** | **0** |
| **correct by reading, out of 57** | **51** | **55** |

So the real defects are few and specific: two routing misses, one retrieval gap where the defining chunk is not among the five, one model-reasoning failure on a cross-reference, and two partial answers.

**Judge corrections, proven on stored answers, old results preserved:** markdown emphasis is now stripped before phrase matching (validated over 336 stored runs; exactly 9 verdicts changed, all the same case); two work-order judge fixes for negation windows and for source-comparison sentences being read as conditions (validated over 243 runs; 4 verdicts changed). No expectation was relaxed to help the candidate.

**Judge gaps found and reported, deliberately not patched:** literal substring matching undercounts correct paraphrases; a forbidden phrase fires inside a negation; the citation check reads structured citations, not the answer's own source line; a prerequisite is scoped by a heading naming the action; a page read from a "(p.N)" section label.

## 4. Step 4 — intent and routing

**How the assistant identified the module before this step (READ):** one embedding of the question, ten nearest chunks, per-module best distance; if the top two modules are within 0.07 the request is sent back as a clarification; otherwise the top module's chunks are the excerpts. The originating module supplied by the widget was **not used at all** on the documentation path. Nothing recognised a named method or an action.

**Module context availability (PROVEN, from the widget source):** the Technical widget always sends the originating module plus vessel identity and the current page path. So context is the screen the user is on, never the topic of the question: a Safety question asked from a Technical screen arrives labelled Technical.

**Implemented behind two flags, both default off (= served behaviour):**
- **Intent routing** — a module name or alias in the question decides the module; failing that, a manual or sub-module name derived from the corpus document titles decides it. Generic single words such as "history" or "sync" are excluded; a term mapping to two modules is dropped. An explicit module name beats a manual name and cancels the clarification. The originating module only breaks a tie when it is already one of the near candidates. Identity, tenant and vessel checks are untouched — routing only selects which module's chunks are read. The response now reports the routing reason.
- **Hybrid excerpt selection** — a lexical ranking over the existing text-search column within the routed module (OR of the question's content words, contents pages excluded, the chunk's own heading weighted alongside its body).

**Routing suite (13 cases, embeddings only, no answer model):** the three work-order intents, a pump phrasing, the frozen hazard-categories case in three context variants plus a conflicting explicit module, and two guards that context must not override an explicit name.

| variant | result |
|---|---|
| C0 flags off (served behaviour) | 8/13 |
| D1 intent routing only | 11/13 |
| D2 routing + score-fusion selection | 13/13 |
| D4 routing + lexical rescue (final) | 13/13 |

Case 05 behaviour: with flags off the question returns a clarification in all three context variants (margin 0.010). With routing on it goes to Safety and all five excerpts are the Risk Assessment manuals, in every context variant. "In the Incident module, …" goes to Incident, as the explicit module must win. "How do I report a near miss?" asked from a Technical screen still goes to Incident, so context never overrides.

No test question is hard-coded; the recognised terms come from the corpus document titles. No source type is preferred — the pilot files compete on the same footing as the manuals.

## 5. Step 5 — routing and selection measured separately

One image, one index, one model, one prompt, one key; only the flags differ. Each step compared against the one before.

| suite | C0 flags off | D1 routing | D2 fusion α 0.5 | D3 fusion α 0.7 |
|---|---|---|---|---|
| routing 13 | 8 | 11 | 13 | 13 |
| retrieval 18 | 18 | 18 | 16 | 16 |
| frozen 12 | 11 | 11 | 8 | 9 |
| corrected 14 | 11 | 12 | 10 | — |
| work-order 8 | 6 | 5 | 8 | 5 |
| manual coverage 57 | 24 | 24 | 16 | — |
| tokens in/out per answer · latency mean | 2,076/757 · 11.4 s | 1,788/491 · 7.3 s | 1,783/306 · 5.3 s | 2,055/535 · 7.2 s |

**Attribution.** Routing alone buys three routings and the frozen clarification case, and costs nothing. The score fusion buys the two work-order misses but costs a frozen chunk, two top-1 reorderings, three corrected-claim citations moved to pilot files, and manual coverage 24 → 16.

**Why the fusion loses chunks (PROVEN by an embeddings-only diagnostic):** (i) a chunk outside the lexical top-10 is scored as lexical zero, so a near chunk can be displaced by a distant one sharing a single word; (ii) the two scales are not comparable — the vector term stays below 0.4 for every real hit while the normalised lexical term reaches 1.0, so at nominal "half and half" the lexical side decides. Raising the vector weight does not cure (i), which D3 confirms.

**Choosing the alternative without spending answer calls.** Four selection variants were compared on 104 suite questions using embeddings only: the served five; the fusion; fusion over the complete lexical list; and "lexical rescue" = keep the served five, and when the lexical leader is absent give it the last slot.

| expected source among the five | n | served | fusion | full-list fusion | rescue |
|---|---|---|---|---|---|
| routing probes | 13 | 7 | 9 | 9 | 9 |
| work-order | 8 | 5 | 8 | 8 | 7 |
| frozen | 12 | 11 | 11 | 11 | 11 |
| corrected | 14 | 14 | 14 | 14 | 14 |
| manual coverage | 57 | 53 | 50 | 49 | 52 |
| served excerpts retained (manual questions) | 258 | 258 | 161 | 167 | **244** |

Rescue keeps 95 % of the served excerpts, supplies the overview for both work-order misses, and loses one manual case at retrieval level. It changes exactly one slot; no threshold, excerpt count, prompt wording or vector ordering changed with it.

## 6. Step 6 — the final candidate package (D4), verified as one unit

| item | value |
|---|---|
| image | `sail-assistant-py:prompt-v5-r6`, id `58d02521e6ae` |
| model / sampling | gpt-5.6-luna, default temperature |
| prompt hashes | docs `ff9ee87141ac1362` · tool-loop `7a028346c1c2fdf0` · combined `aea94e2f5edb6948` |
| retrieval | floor 1.15 · margin 0.07 · top_k 10 · 5 excerpts; intent routing on; lexical rescue on |
| index identity | `kb-pilot-c`: 916 chunks, 30 documents = 855 manual + 56 corrected code-derived + 5 pilot; build key `clean=off · xrefs=2026-09-14.4 · repairs=2026-09-14.1 · chunker=2026-03-17.original · 1200/150 · embed=llamaindex-meta9 · text-embedding-3-large:3072` |

| suite (×3, all runs required) | D4 final | D1 routing only |
|---|---|---|
| routing 13 | 13 | 11 |
| retrieval 18 | 18 | 18 |
| frozen 12 | 11 automatic, 12 by reading | 11 |
| corrected 14 | 12 automatic, 13 by reading | 12 |
| work-order 8 | 7 automatic, 8 by reading | 5 |
| manual coverage 57 | 18 automatic | 24 automatic |

**Individual failures on D4.** Frozen case 05: the hazard list is complete in all three runs; the judge rejects the page read from the top citation's section label. Corrected case 1: the answer says "generates" where the test requires the literal "generated". Corrected case 4: the expected-substring is not present in the target file name — a test defect. Work-order generic-03 run 1: the prerequisite is stated under a heading the judge does not scope to that action. Manual coverage: one Audit History question routed to Technical; one question still returns a clarification; two questions whose required sentence is in no retrievable chunk on any set; one case lost to the rescued slot; one cross-reference the model declines to resolve although both sections were supplied.

**The manual-coverage difference from D1 is mostly not a regression.** Of the six cases D4 loses, five received byte-identical excerpts on both candidates and differ only in the model's wording between runs; one lost the expected chunk to the rescued slot; one is ambiguous. Fifteen of the 57 questions receive a different fifth excerpt at all.

**Cost and latency (PROVEN, from stored usage and the service's own log).** 273 answers used 424,371 input and 82,199 output tokens, i.e. 1,554 in / 301 out per answer. At the published price that is **≈ $0.67 per 1,000 questions**. Latency mean 4.7 s, median 4.3 s, p95 9.4 s, measured with two candidates answering concurrently on one host; a single candidate was not measured separately. The whole step-4-to-6 exercise cost about $0.66 for 903 answers.

**Remaining limitations.** (1) A question naming only a generic word routes by distance alone. (2) One question still returns a clarification, because context breaks a tie only when the originating module is among the candidates, and here it is not. (3) Two manual sentences exist in no retrievable chunk. (4) The rescued slot costs one manual case. (5) Answers vary run to run at default temperature; on the 57-case suite the all-runs-required total carries a band of roughly ±4–8 cases. (6) The judge gaps listed in §3 are reported, not patched, so automatic totals understate answer quality. (7) The 57 manual cases were re-read by hand for the manuals-only and full sets, but for D4 only the 15 questions whose excerpts changed and the 7 that flipped; the other 42 receive identical excerpts and inherit the earlier reading.

---

## 7. What the reviewer is asked to check

1. Does the A/B/C comparison actually establish what the manuals alone support, or does any part of the conclusion rest on the richer sets?
2. Is the support check sound — captured excerpts, required phrases, no credit for filename or keyword matches — and does the six-label reading avoid grading the candidate generously?
3. Is the routing rule bounded and safe: corpus-derived terms only, explicit module wins, context only breaks a tie, no permission or vessel bypass, no test question hard-coded, no source type preferred?
4. Is the attribution clean, given that each stage changed one thing and was compared with the same model, prompt, key and index?
5. Is choosing the selection variant on an embeddings-only comparison before spending answer calls a sound method, or does it bias towards keeping the served excerpts?
6. Is the manual-coverage difference between D4 and D1 correctly attributed to run-to-run variance plus one real loss, or does it need the remaining 42 cases re-read before the claim stands?
7. Is anything in the final package record missing for a promotion decision: image, model, prompt hashes, source inventory, index identity, usage, cost, latency, limitations?
8. Given all of the above, is the recommendation of D4 over D1 justified, or is the routing-only candidate the safer promotion?

Nothing is deployed. Promotion would also move the live service to this model, prompt and dedicated key, which is a separate decision for the owner.
