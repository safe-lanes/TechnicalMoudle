# SAIL AI Assistant — Python/FastAPI Port + Tool-Coverage Plan

**Status:** planning only, no code. Decided 11-Sep-2026 (owner) after the four Stage-5 audits.
**Decisions locked:** (1) rewrite the central service in **Python/FastAPI**; (2) do it **now,
at Stage 5**, before the admin console; (3) the Audit-3 per-tool coverage and Audit-4 scale
fixes land **in the port, once — not twice**; (4) tool coverage is the **top priority**, ahead
of the console. **(5) Owner instruction 11-Sep: SMS RAG is NOT the template** — it is a year
old; the stack is to be chosen as an architect would today. §S below is that choice, researched
against the Sep-2026 landscape, and each row is a decision put to the owner (standing rule).
**Owner ruled row-by-row on 11-Sep** — statuses are in the last column; §S.1 (the Pydantic AI
spike) and §S.2 (indexer change) record the two conditions attached.

---

## S — The stack, architected (researched Sep-2026, not inherited from SMS RAG)

What moved in a year, honestly: the "hand-rolled while-loop calling OpenAI" (which is exactly
what our Node service is) is no longer what production teams ship; agent frameworks
consolidated; pgvector became the default when you already run Postgres; open-weight
rerankers reached production quality; evaluation frameworks matured into CI-grade tools.

| Layer | Recommendation | Why (evidence-based) | Alternatives considered | DECISION NEEDED |
|---|---|---|---|---|
| Web framework | **FastAPI + uvicorn** | still the Python default for async APIs; Pydantic-native; OpenAPI for free | Litestar (fine, smaller ecosystem) | **CONFIRMED** |
| **Agent / tool loop** | **Pydantic AI** | type-safe tools + structured outputs (our tool contracts are JSON-schema already); **model-agnostic** — OpenAI today, **Anthropic/Bedrock switch is a config change** (the Bedrock track in the enterprise plan becomes trivial); light dependency, no LangChain-style lock-in; replaces our hand-rolled loop with a maintained one | LangGraph (durable stateful graphs — overkill for a single-agent tool loop; worth it later only if walkthroughs need checkpointed multi-step state) · OpenAI Agents SDK (fastest, but **OpenAI-locked** — kills the Bedrock option) | **SPIKE FIRST — §S.1.** Owner's benefit is model-agnosticism (Bedrock = config change, data residency), NOT less code. Adopt only if all four loop guarantees survive intact; otherwise keep the hand-written loop. |
| **Vector store** | **pgvector inside the assistant's own Postgres container** (`sail-assistant-db`, image swap `postgres:16-alpine` → `pgvector/pgvector:pg16`) — migrate the 907 chunks; retire the standalone Chroma **server** container | **Measured 11-Sep (PROVEN):** the assistant already runs TWO store containers on the AI box — `sail-assistant-db` (Postgres 16, 44 MiB RSS, 8 MB data, added by me at Stage 2 for pairs/log/ratings) and `technical-chromadb` (Chroma server, 255 MiB RSS). pgvector is NOT "a Postgres we already had" — it is *consolidating our two store servers into one*; net −1 container, ~−200 MiB. Hybrid search (vector + full-text) in plain SQL. **Corrected from the first draft**, which wrongly implied a pre-existing Postgres on the box (the SMS RAG prod host has none — PROVEN). | keep both as they are (works at 907 chunks; two servers to back up/upgrade forever) · go fully embedded — SQLite + Chroma-as-library like SMS RAG does (zero DB servers; loses multi-instance and the console's SQL surface) | **CONFIRMED** on the corrected justification ("two stores become one; Chroma is the heavier"). Owner: "I do not want two stores." Rides along in the port because retrieval is rewritten anyway. Indexer change → §S.2. |
| Embeddings | keep **text-embedding-3-large** (dedicated key) | proven; changing the model means re-indexing; local embeddings (bge-m3) is a later option, not needed now | — | **CONFIRMED** |
| **Reranker** | **BGE-Reranker-v2-m3, self-hosted** (CPU is fine at top-20 candidates) | 2026's production default: open license, ~12 ms/pair, multilingual; **no new vendor, no data egress** for the doc excerpts | Cohere Rerank 4 (managed, best-in-class, but another API + egress) · Qwen3-Reranker (top open-weight, heavier) | **APPROVED IN PRINCIPLE — NOT in the port.** Own step after the port (Stage 5-RERANK) with BEFORE/AFTER retrieval numbers on the smoke set, so a quality move is attributable. Flag model size + CPU latency at that point. |
| **Evaluation** | **DeepEval** (pytest-native) for CI gates: faithfulness / answer relevancy / hallucination | fits our suite culture exactly — quality checks run like the p01–p04 harnesses before every deploy; RAGAS is for exploration, not CI | RAGAS · TruLens (production monitoring — later) | **CONFIRMED**; lands in 5-TOOLS |
| **Observability / tracing** | **keep our own Postgres conversation log + lean Stage-6 console** for now; instrument with OpenTelemetry so a tracing backend can be attached later | Langfuse self-hosted is MIT/free and would replace much of Stage 6 (trace viewer, ratings, cost per client) — **but it requires Postgres + ClickHouse + Redis + S3: four services for our scale**; Langfuse *cloud* sends conversation logs off-box, which collides with the privacy posture unless masked-only logging is on | Langfuse self-host (revisit when scale justifies the infra) · Langfuse cloud (only with masked-only logs) | **CONFIRMED** — own log + OTel hooks; Langfuse deferred (privacy reasoning accepted) |
| DB access | **SQLAlchemy 2.0 async + asyncpg, Alembic migrations** | maintainable by the team; migrations become explicit and reviewable (vs today's `CREATE TABLE IF NOT EXISTS` at boot) | raw asyncpg (fine for 4 tables, worse as the console grows) | **CONFIRMED** |
| Rate limiting | **Postgres-backed** sliding window | multi-instance-safe with no new infra | Redis (only if we adopt Redis for something else) | **CONFIRMED** — Postgres |
| Identity token | keep **HMAC-SHA256 wire format** (Python reimplementation) | byte-compatible with the Node module side — nothing on the Technical side changes | JWT (would force a module-side change for no gain) | **CONFIRMED** |
| Tooling | **uv** (env/lock), **ruff**, **mypy**, **pytest**, `pydantic-settings`, multi-stage Docker | 2026 Python standard; reproducible builds | pip/poetry | **CONFIRMED** |
| Streaming | SSE token streaming — **later stage** (widget change) | modern chat UX expectation; not needed to port | — | later |

Sources consulted (Sep-2026): [agent frameworks](https://open-techstack.com/blog/langgraph-vs-openai-agents-sdk-vs-pydanticai-2026/) · [Pydantic AI vs LangGraph](https://dev.to/linou518/the-2026-ai-agent-framework-decision-guide-langgraph-vs-crewai-vs-pydantic-ai-b2h) · [pgvector vs Chroma](https://zilliz.com/comparison/chroma-vs-pgvector) · [vector DBs 2026](https://www.braintrust.dev/articles/best-vector-databases-for-rag-2026) · [rerankers 2026](https://futureagi.com/blog/best-rerankers-for-rag-2026/) · [BGE v2-m3 default](https://docs.bswen.com/blog/2026-02-25-best-reranker-models/) · [DeepEval vs RAGAS](https://qaskills.sh/blog/deepeval-vs-ragas-rag-evaluation-2026) · [Langfuse self-host reqs](https://jangwook.net/en/blog/en/langfuse-self-hosted-llm-tracing-setup-guide-2026/).

**AI test server, measured 11-Sep-2026 08:08 UTC (PROVEN, `ssh` + `free/df/docker stats`):**
4 vCPU · 15.8 GB RAM, 4.3 GB used, **11.5 GB available**, no swap · disk 309 GB, 234 GB free ·
14 containers (heaviest `viq-rag-system-new` 1.2 GB; `sms-rag-app` 352 MiB; ours: `sail-assistant`
15 MiB + `sail-assistant-db` 44 MiB + `technical-chromadb` 255 MiB) · load avg 0.00 · 15.9 GB of
unused images + 23.7 GB build cache reclaimable (housekeeping, not touched). A 1 GB reranker
(~1.5–2 GB resident) fits with room; it is still the largest thing we would add. **Production SMS
RAG host (13.250.9.130): one container, no Postgres, no Chroma server (embedded) — PROVEN.**

### S.1 — Pydantic AI spike (day one of 5-PORT; result reported as a DECISION before anything is built on it)

Our loop is not generic. Four guarantees must survive **inside** the framework, unbent:

| # | Guarantee (as the Node loop enforces it today) | Spike proof (captured, not read) |
|---|---|---|
| G1 | **10 s per-tool budget**, timeout returned to the LLM as data (the loop continues, the answer says the tool timed out) | a tool that sleeps 15 s; assert the run continues, the LLM sees a timeout message, wall-clock ≈ 10 s for that call |
| G2 | **90 s soft deadline → honest partial answer**, labelled `partial: true` (not an exception, not a truncated stream) | drive a run past 90 s with slow tools; assert a labelled partial answer comes back |
| G3 | **Masking on the way out** — every string leaving for the model is tokenised at ONE choke point (messages, tool results, tool schemas) | capture the actual outbound HTTP bodies (httpx transport seam); grep for seeded real names/IMO/UUIDs → zero |
| G4 | **Un-masking LLM-produced tool arguments before execution** — modules always receive real values | a tool that records its received args; LLM is given only `[VESSEL_1]`; assert the tool received the real name |

Also required: pinned versions (`pydantic-ai==2.42.0`, `openai`, `httpx` exact), model-agnosticism demonstrated by swapping the model string for a second provider adapter without touching the loop code (an Anthropic adapter with no key still proves the *shape*; a live Bedrock call is a later, keyed test).
**Verdict rule:** any of G1–G4 needing a workaround, monkey-patch, or fork → **keep the hand-written loop** (proven, ours) and use Python + the plain `openai` SDK; the port proceeds either way, only `agent.py` differs.

### S.2 — What changes in the indexer for pgvector (SMS RAG untouched)

Today the indexer is a *copy* of SMS RAG's `indexer_unified_refactored.py`, env-gated to write to our Chroma server over HTTP (`indexer_http.py`, 3 client sites + 3 collection-name sites swapped). The SMS RAG original is not touched now either; that copy becomes the assistant's own `central-assistant-py/indexer/` and only its **write stage** changes:

1. **One-shot migration, no re-parse, no re-embed:** `migrate_chroma_to_pgvector.py` reads all 907 chunks (text + 3072-d embedding + metadata incl. `module`, source manual, section) from Chroma via the existing tunnel and inserts them into `assistant_chunks` (pgvector `vector(3072)`, HNSW index, plus a `tsvector` column for the full-text half of hybrid search). Cost: minutes, zero OpenAI spend. Proof: count 907 = 907 and the 18-query smoke set routes identically.
2. **Ongoing indexing:** parse (LlamaParse agentic) + chunk + embed stages are unchanged; the Chroma `upsert` becomes a Postgres `INSERT … ON CONFLICT (chunk_id) DO UPDATE`. `tag-modules.py` (prefix-derived module tag) becomes one `UPDATE`.
3. **Retire:** `technical-chromadb` container + `technical_chroma_data` volume, only after the smoke set passes on pgvector and the Node service is gone (Node still reads Chroma until cutover).

**S.2 as built (11-Sep, owner ask "the port is not done until new documents can be added"):**

- **What produced the current 907 chunks (PROVEN from `rag/dev/tools/indexer_unified_refactored.py`
  + the stored chunk metadata `llamaparse_tier=agentic, llamaparse_version=latest`):** LlamaParse
  **v2** (`/api/v2/parse/upload`, tier *agentic*, markdown output with page map) for PDF **and**
  DOCX, then a custom chunker — split each page's markdown by headings (text before the first
  heading = "Preamble"), cut sections into ~1200-char windows with 150 overlap, content-derived
  sha1 ids, metadata `file/slug_url/breadcrumb/section_title/page_number/chunk_index` — then
  OpenAI `text-embedding-3-large`. Not basic extraction. The Python indexer keeps exactly this.
- **Schema (Alembic 0002 + 0004):** `assistant_chunks(index_set, id) PK · module · file ·
  section_title · breadcrumb · page_number · chunk_index · content · metadata jsonb ·
  embedding vector(3072) · tsv tsvector (generated, unused for ranking yet)`; b-tree on
  `(index_set, file)` and `module`, GIN on `tsv`. `assistant_documents(index_set, file) PK ·
  sha256 · chunks · pages · stub · parser tier/version · embed_model · indexed_at` = the manifest.
- **Vector index:** none, deliberately. 907 rows scan in <1 ms; pgvector's HNSW/IVFFlat cap the
  `vector` type at 2000 dims and ours are 3072. If the corpus ever grows into the tens of
  thousands, the route is a `halfvec(3072)` expression index (HNSW, cosine) — a one-line
  migration, no re-embed.
- **Single-manual re-index — yes:** `index_documents.py --index-set <set> --only "<file>"`
  replaces that file's rows inside one transaction (DELETE file-in-set → INSERT → UPSERT manifest);
  nothing else is touched; unchanged files (same sha256) are skipped unless `--force`. Adding the
  Noon Report manual when the module ships = drop the file in `documents/`, run with `--only`.
- **Index sets:** the service reads ONE set (`ASSISTANT_INDEX_SET`, default `migrated`). A fresh
  re-index lands in a named set beside it; `compare_sets.py` measures both (per-document chunk
  counts, <100-char chunks, pages; the 18 smoke queries routed against a service instance per
  set); the switch is an env change after the measurement, not before.

**S.2 re-index comparison — MEASURED 11-Sep-2026 (PROVEN), verdict: STAY ON `migrated`.**
Full fresh re-index of all 25 manuals through the Python indexer (LlamaParse v2 *agentic*,
`latest`, LlamaCloud cache bypassed) → set `py-llamaparse`: 25/25 parsed, 0 failures, **908
chunks vs 907**, per-document counts within ±3 except Risk Assessment Office (+8) — parse
structurally the same (same page counts everywhere; <100-char chunks 86 vs 90).
*Retrieval, same 18 smoke queries, routeOnly, one service instance per set:* **migrated 18/18 ·
py-llamaparse 15/18.** The new set drops two Audit queries into the *clarify* gate ("prepare for
an upcoming audit" margin 0.004 Audit/Technical; "history of past audits" margin 0.032
Audit/Technical/Crewing), cites the wrong Incident manual once, and its routing margins collapse
on three more queries (fleet sharing 1.00→0.20, fleet notifications 1.00→0.17, add crew member
1.00→0.14). Off-topic gates unchanged. Canonical `smoke-suite.mjs` on the new set: 2/18
misrouted, 3 failures (0/18, 0 failures on migrated).
*Why (INFERRED):* same tier and same chunker, but LlamaParse `latest` moved between July and
September — the new markdown carries more inline HTML (416 vs 360 chunks contain tags) and
slightly different section boundaries, which shifts embeddings enough to blur the Audit vs
Technical margin. The indexer is not at fault (chunk-for-chunk parity tests pass); the parser
output drifted.
*Decision:* the live service stays on `migrated` (the owner's rule: switch only when the new set
proves at least equal — it does not). The `py-llamaparse` set is kept in the DB for the follow-up.
*Follow-up (own measured step, not now):* pin a LlamaParse `version` instead of `latest`, and/or
strip inline HTML before chunking; re-run the same comparison; switch only on ≥ 18/18. New
manuals (e.g. Noon Report) index into `migrated` via `--only` with the current pipeline — the
indexer path itself is proven end to end.

**S.3 — Parser thread, 14-Sep-2026 (MEASURED; live set unchanged).** Facts that changed the
plan: the 907 live chunks were parsed on THREE dates (2-Jul / 9-Sep / 10-Sep), not July; the
API returns no parser version (`metadata.version` documented but ABSENT in 25/25 tested
responses — evidence retained per parse, owner raising with support); **no tier is
deterministic** — same file, same pinned version, one day apart: agentic 1/33 identical pages,
cost_effective 3/33. The churn lives in screenshot-derived content (captions / OCR'd tables /
callout graphs); once that is stripped the instruction text is ≈97 % word-stable (still not
byte-stable). Built: content-checked pre-chunk cleanup with a per-block removal log
(`indexer/clean_markdown.py`), cross-reference resolution (`xrefs.py`, 41/41), a durable
**parse store** (`assistant_parses`, key = file sha256 + tier + requested version + output
options, raw response retained; unchanged file+config ⇒ rebuild from the saved parse, parser
never called), answer-level acceptance (`acceptance_answers.py`, 12 cases on callouts / tables /
cross-refs / notes), stability by original page (`stability_report.py`). Third set `ce-clean`
(cost_effective pinned 2026-08-19 + cleanup + xrefs) = 773 chunks.
*Result:* 18-query retrieval migrated **18/18** · py-llamaparse 15/18 · ce-clean **16/18**;
answer-level (12) answers 8 · 8 · **10**, citations 10 · 6 · 9. ce-clean answers the
cross-referenced sections the live set cannot, but misses two retrieval cases (Incident vs Near
Miss manual, Lesson Learnt) and its margins are thinner. **Bar (≥ 18/18) not met → the live set
stays `migrated`.** The gains are attributable to cleanup + cross-refs, not to the tier.
*Proposed next (needs owner GO):* `agentic-clean` — the live set's own cached parses + cleanup +
cross-refs (zero parse cost), to isolate the cleanup effect on the 18/18 baseline.

**S.4 — Controlled experiment on the live set's own parses (14-Sep-2026, MEASURED; live unchanged).**
*Baseline proof:* rebuilding from the cached parses first gave 907/907 identical chunk ids but
**16/18**, because the live set was embedded by LlamaIndex on **metadata + text** (9 keys prepended:
file, slug_url, breadcrumb, section_title, source_type, chunk_index, page_number, llamaparse_tier,
llamaparse_version — PROVEN from the node record in Chroma and by cosine against the stored
vectors). With that input the rebuild (`ag-base`) reproduces **18/18**; the embedding mode is now
part of the build key. Residual distance shifts (+0.03–0.05) were first labelled "OpenAI embedding
drift" — NOT established; corrected in §S.5 ("unexplained embedding variation", measured).
*Four builds from the same parses, all embedded like the live set:*

| set | retrieval (18) | joint answers (12, 3-run majority) | regressions vs live | gains |
|---|---|---|---|---|
| live `migrated` | 18/18 | 7/12 | — | — |
| live + new prompt (`migrated-np`) | 18/18 | **9/12** | none | xref 08, 09 |
| `ag-base` (rebuild, nothing else) | 18/18 | 8/12 | none | xref 08 |
| `ag-xref` (cross-refs on) | **18/18** | **9/12** | none | xref 07, 09 |
| `ag-clean` (cleanup on) | 17/18 | 9/12 | none | xref 08, 09 |
| `ag-both` (cleanup + cross-refs) | 17/18 | 9/12 | none | xref 07, 09 |
| `ce-clean` (cost_effective + both) | 16/18 | 7/12 | callout 03 | xref 07 |

*Attribution (proven, not inferred):* the one retrieval case cleanup loses ("raise a lesson
learnt") is NOT chunk size — the Incident manual's own "Part H: Lessons Learnt" chunk (1.0556)
edges the Lesson Learnt manual's p9 chunk (1.0675) after cleanup changed that chunk's text and
removed the TOC chunk that used to rank second; both manuals are legitimately about lessons
learnt. The earlier "smaller chunks" explanation is withdrawn. Cross-reference resolution
retrieves correctly (the resolved chunk is the top excerpt) but the answer model refused to use
steps that name another sub-module until the prompt got a hard rule and the resolved text names
both sections ("the steps for Stores › How To Apply Filter are the same as section 1.1.7.7 … under
Spares, page 47"). Two cases fail on every set: 01 (the instruction lives only in a screenshot
callout that the agentic parse never transcribed) and 05 (the hazard-category table exists only
as a caption in the agentic parse) — evidence absent, not routing. Answers vary run to run at
temperature 0.2 (3-run majority used; see disagreement list in the report).
*Conclusion:* nothing here justifies leaving LlamaParse or the agentic tier. The improvements that
help the existing baseline are (1) the answer-prompt rule and (2) cross-reference resolution;
cleanup is neutral on answers and costs one retrieval case on this corpus — its value is churn
reduction for future re-parses, not accuracy today. Recommendation put to the owner: deploy the
prompt rule; adopt `ag-xref` as the served set (18/18, no regression, +2 cross-ref cases, honest
attribution); keep cleanup as an option for new documents, not for the live corpus.

**S.5 — Prompt-rule deployment attempt, 14-Sep-2026 (owner decision: "deploy the prompt rule only,
hold ag-xref"). Outcome: deployed, measured, ROLLED BACK by the owner's own rule; the reported
9/12 is RETRACTED.** Artefacts: `docs/assistant-experiments/2026-09-14/` (every comparison
output, the per-case response dump, index-run logs, configuration record).
*What was deployed:* the exact tested wording (no change since commit `2e16829e1`), labelled
`PROMPT_VERSION = v2-xref-hardrule-2026-09-14`, content hashes docs-path `b37172f6122a0257` ·
tool-loop `f8e5a8f86bede638` · combined `ebfd83a623e41173`, now reported by `/health.prompt`.
Image `sail-assistant-py:prompt-v2` (8db669090d36) on `127.0.0.1:8016`, index set `migrated`, no
reindex. The previously live image (untagged `e12c0b916d4c`, 11-Sep — NOT `:port` as earlier notes
said) was tagged `sail-assistant-py:prompt-v1-rollback` and kept running on 8015; nginx was
switched 8015→8016 (backups `*.bak-8015-*`), then back.
*Measured, comparator = old prompt on 8015, same index, same day, 3-run majority:*

| measurement | index | prompt | joint (12) | vs comparator |
|---|---|---|---|---|
| S.4 table row "migrated" | migrated | old | 7/12 | — |
| S.4 table row "migrated-np" (8023) | migrated | v2 | 9/12 | +08, +09 — **both invalid, see below** |
| S.4 rows ag-base / ag-xref | ag-base / ag-xref | v2 (same prompt on both) | 8/12 · 9/12 | 08 (invalid) · 07+09 |
| deploy check 1 (`deploy-verify-8016.txt`) | migrated | old vs v2 | 7/12 vs 8/12 | +09 (2/3, wording only) |
| deploy check 2, corrected suite (`acceptance-live-final.txt`) | migrated | old vs v2 | **7/12 vs 7/12** | none, no regression |
| retrieval, both checks | migrated | — | 18/18 vs 18/18 | identical distances |

*Why the 9/12 was wrong (PROVEN from the manual chunks and the response dump):*
- Case 08 asked about "the Onboard list in Crewing". The Crewing manual's Recruitment area has
  In-Progress (1.2.1), Recruited (1.2.2), Waitlist (1.2.3), Rejected (1.2.4) — there is **no
  Onboard list**; "Onboard" is only a crew status (1.4.1.7). Every "pass" on this case was the
  model asserting that the steps are "the same as" Crew Database export (1.3.1.4, p.28) — an
  equivalence the manual never states — and the judge accepted it because the answer contained
  "export". The case is rewritten to the Waitlist (whose manual pointer 1.2.3.3 says "Refer to the
  In-Progress sub-sub-module", i.e. 1.2.1.5 on p.19: Edit icon → Export button) and rejects
  "Crew Database". The resolver's target (In-Progress) matches the manual; that part stands.
- Case 09's "pass" was the attribution regex matching the phrase "same as" in a run that merely
  restated the manual's pointer ("Refer to the 'Defect Log' sub-submodule. Follow the same
  procedure"). All 6 final runs on both prompts give that identical non-answer. The judge now
  rejects a pointer restated without any concrete step; with it, 09 fails on both prompts.
- Consequence: on the live index the cross-reference sections contain only the pointer, so the
  prompt rule has nothing to apply — the rule only helps when the resolved steps are in the
  retrieved chunk (`ag-xref`). Prompt-only deployment has **no measurable effect** on the served
  set: it neither gains nor regresses (9 runs per case across three measurements).
*State after rollback:* public URL → 8015 (old prompt, `/health` has no `prompt` field);
`sail-assistant-py-v2` left running on 8016 for the owner's decision (delete or promote); the
eight comparison instances 8017–8024 are removed; all index sets stay in the DB (`migrated`,
`ag-base`, `ag-xref`, `ag-clean`, `ag-both`, `ce-clean`, `py-llamaparse`, `ag-reuse`).
*Embedding record (owner ask; replaces the "drift" label):* model `text-embedding-3-large`,
3072 dims, OpenAI direct (no Azure deployment), vectors stored in pgvector `vector(3072)` as a
full-precision text literal, no normalisation, squared L2 at query time. Measured
(`probe_determinism.py`, 3 chunks): same input embedded twice now → cosine 1.000000; now vs our
14-Sep vectors → 0.9997–0.9999; now vs the live `migrated` vectors → 0.980–0.984. Our
reconstruction of the LlamaIndex input matches for 907/907 chunks (`embed_sha` computed from the
reconstructed input — NOT a record of the original embedding requests, which were never captured).
Owner's framing (14-Sep, adopted): the two matching calls demonstrate repeatability in that test
only; they do not prove universal provider determinism, and they do not establish that the
historical difference came from the original input. The residual is therefore recorded as
**"unexplained historical embedding variation"**, bounded at cosine ≈ 0.98 on the sampled
chunks, cause not established. What IS established: **stored-vector reuse** (`embed_sha` =
sha256(model + exact input) in chunk metadata; backfilled into `migrated` and `ag-base` from
reconstructed inputs, additive metadata only) makes a rebuild of unchanged chunks reuse the
served set's vectors verbatim — PROVEN: `ag-reuse` rebuilt 907/907 with 0 embedding calls and
identical retrieval distances to `migrated` (17/18 equal, one query differs 0.7847 vs 0.7845 =
the live-computed *question* embedding). Evidence kept in
`docs/assistant-experiments/2026-09-14/compare-migrated-vs-ag-reuse.txt`.
*Reproducibility record now stored per document* (`clean_report.build`): parser + full request
configuration, cleanup version, resolver version `XREF_VERSION` + settings, chunker version,
chunk params, embedding input mode, model + dimensions, vector handling; the resolver version
and model:dims are part of the build key. The answer-prompt version is a serving property,
recorded by `/health.prompt` (version + hashes), not in the index.
*Next priority (owner-set):* targeted extraction repair for cases 01 (Audit Preparation p.15
export callout) and 05 (Risk Assessment hazard-category table), verified against the source
manuals; cleanup stays experimental. `ag-xref` remains on hold pending the owner's read of this
section.

**S.6 — Source-backed evaluation + targeted extraction repairs, 14-Sep-2026 (MEASURED; live
unchanged; deployment ON HOLD for owner review).** Artefacts: `docs/assistant-experiments/2026-09-14-repairs/`.
*Sources (step 1):* fresh copies from `D:\manuals` — all 20 PDF hashes identical to the ingested
and parse-store copies (`source-inventory.md`); no re-parse needed, all 25 saved parses reused.
The 5 `Technical - … (Operational)` .docx files are NOT manuals: they were generated by the
assistant build on 10-Sep from the code. Audited claim-by-claim against the repository
(`generated-docs-audit.md` + detail): 98 SUPPORTED · 46 PARTLY · 4 UNSUPPORTED — the four outright
wrong sentences are "job codes must be filled in and unique" (auto-generated), "run Sync Masters to
populate vessel codes" (vessels are NO_SYNC), "an HOD can do everything an office user can for their
department" (no such layer), "amber also means changes waiting" (stale is time-based only). They
stay in the corpus unchanged for this comparison; correcting them is a separate, owner-decided step.
*Live preserved (step 2):* public URL → 8015, old prompt, `migrated`; the prompt-v2 container's
logs saved (`~/central-assistant-py/preserved/`) and the 8016 container removed; nginx untouched.
*Suite corrected and FROZEN (step 3):* every expected answer checked against the page renders and
the saved parses (`render/`); each case now carries accepted pages, required phrases and a source
note (`acceptance_answers.py`, `SUITE_VERSION 2026-09-14.2`); case 08 = Waitlist → In-Progress
1.2.1.5 (Edit icon → Export button, p19–20), rejects "Crew Database"; xref cases reject a restated
pointer and require the named source section. **Post-freeze change, reported:** `.3` adds
"download" to case 08 after run A showed the candidate omitting the final Export step (below).
*What the saved parse missed (step 4, PROVEN from the renders):* case 01 — the eight Figure 20
callouts on Audit Preparation p15 (export icon, vessel comments, Yes/No compliance, Save) were
reduced by the agentic parse to one caption; case 05 — the six hazard-category tabs of the "Select
Applicable Hazards" pop-up (Work Environment, Equipment, Programs/Procedures, Processes (Act),
People, Organization; RA Office p13 Figure 15, RA Vessel p12 Figure 14) were reduced to "categories
like Work Environment and Equipment". Repairs saved separately from the raw parse in
`indexer/repairs/<sha16>.json` (document sha256, page, figure, method = vision transcription of a
200-dpi render by Claude Fable 5.1 re-checked against the page, version `2026-09-14.1`), applied at
build time by `indexer/repairs.py` (`--apply-repairs`; ignored + reported on sha mismatch); the raw
parse store is untouched; `REPAIR_VERSION` is in the build key and the per-document build record.
*Cross-references (step 5):* all 41 pointer→target pairs verified against the manual's heading
tree (`xref-pairs.txt`): the "Promotions" pointers resolve into 1.6.1 All (Crew Promotion), the
Defects "Management tab" pointer to the Management Dashboard filter 1.1.3.3, 4 are chains through
the manual's own pointers (now stated in the label, resolver `.3`); 0 unresolved, 0 ambiguous.
Run A exposed a resolver defect: a target section's steps were cut at the page end (Crewing
1.2.1.5 ends with "Click the 'Export' button…" as the first paragraph of p20), so the Waitlist
answer omitted the final step. Fixed in resolver `.4` (next-page continuation joined to the
section body; unit-tested); cleanup stays OFF.
*Candidate build (step 6):* set `repaired` = the live set's own 25 saved parses + repairs +
cross-references, no cleanup, 912 chunks; build record per document (parser + full request
configuration, cleanup off, `XREF_VERSION 2026-09-14.4`, `REPAIR_VERSION 2026-09-14.1`, chunker
`2026-03-17.original`, 1200/150, embed input `llamaindex-meta9`, `text-embedding-3-large:3072`);
vectors: 906/912 reused verbatim from the served set, 6 newly embedded (the changed chunks).
Prompt on both compared instances: `v2-xref-hardrule-2026-09-14` (hashes as §S.5) — the live
8015 (old prompt) is reported alongside; base-v2 vs live is identical (7/12 = 7/12).

| measurement (run B, resolver .4, suite .3, 3-run majority) | live 8015 (old prompt, migrated) | base 8016 (v2 prompt, migrated) | candidate 8017 (v2 prompt, repaired) |
|---|---|---|---|
| retrieval, 18 queries | 18/18 | 18/18 | 18/18 — every distance identical |
| joint answers (answer ∧ citation ∧ attribution), 12 | 7/12 | 7/12 | **11/12** |
| regressions vs live | — | none | **none** |
| gains vs live | — | none | 01, 07, 08, 09 — each 3/3 |

*Each gain, checked against the source (full responses in `acceptance-repaired-v4-dump.jsonl`):*
01 — "click the Excel icon at the top right of the toolbar to export; enter vessel comments in the
Vessel Comments column, select the compliance status (Yes/No), click Save" = the Figure 20
callouts, cited p15. 07 — the Spares 1.1.7.7 steps (Spares › Inventory tab, select Vessel, search,
filters Criticality / Rotation Item / Stock) stated as "the same as section 1.1.7.7 under Spares,
page 47", cited p49. 08 — In-Progress › Edit icon → form opens → click Export to download the crew
form, stated as "the same as section 1.2.1.5 under In Progress, page 19", cited p22 (run A had
omitted the Export step; run B, resolver .4, includes it in 3/3 runs). 09 — "+ New Defect", fill
Part A/B/C, Submit, stated as "the same as section 1.1.4.3 under Defects Logs, page 15", cited
p19. Run A (resolver .3, suite .2) gave the same 11/12 / 7/12 / 7/12 split and is kept for the
record (`*-runA-*`).
*Remaining gap — case 05 (owner's wording, 14-Sep):* "Missing category content was repaired, but
the question still fails because the routing clarification gate stops it before the repaired
evidence can be used." Two problems existed: an extraction gap (the six category tabs lived only
in the screenshot — now repaired, the text is in the `repaired` index) AND a routing problem (the
docs-path router ranks modules across the whole corpus and asks to clarify when the two best
modules are within `ROUTE_MARGIN` 0.07 — here Safety vs Incident at 0.010, identical on live and
candidate per `trace_query`). The module the question was sent from (`context.module = safety`)
is used for the client×module pair and the tool loop, not for routing — inherited unchanged from
the Node service (§4.2 thresholds). One run-to-run split was observed (live, case 11, 2/3) — the
majority rule absorbed it.
*Proposed routing approach (documented, NOT implemented in this candidate; a separate measured
step):* the widget always supplies the originating module (`context.module`, one of the five
labels, set by the host page, not by the user), so it is a reliable signal. Proposal: when the
router's clarify condition fires and the originating module is among the top candidates within the
margin, answer from the originating module and say so in one line ("Answering for Safety; say
'Incident' if you meant that module"); when the question explicitly names another module or manual
("in the Incident module…", "Near Miss manual"), route by the named module instead of the
originating one; keep clarify for the remaining case (originating module not among the close
candidates, no explicit module named). No threshold change. Measure on the 18-query and 12-case
suites plus a small set of deliberately cross-module questions before adopting.
*What this does NOT establish:* the 12 cases probe callouts, tables, cross-references and notes
that this thread touched; they are not a general accuracy measure of the assistant. The
corrected suite re-establishes an improvement ONLY for the four repaired/resolved cases; the
earlier withdrawn claims (§S.5) stay withdrawn.
*State for review:* candidate instance `sail-assistant-py-cand` (`:prompt-v2`, `ASSISTANT_INDEX_SET=repaired`)
left running on `127.0.0.1:8017` for the owner's own checks; nothing public changed. Promotion
would be: nginx 8015 → 8017 (or recreate `sail-assistant-py` on `:prompt-v2` with
`ASSISTANT_INDEX_SET=repaired`); rollback = flip back (old container stays).

**S.6.1 — Generated Technical documents corrected (R3), 14-Sep-2026 (owner-authorised; candidate
corpus only).** The five code-derived .docx files were rewritten as revision R3 from the audit
evidence: `central-assistant-py/generated-docs/build_r3.py` is the source (the documents are built
from it, so the wording is reproducible), `generated-docs/R2/` holds the 10-Sep originals unchanged
(hashes as in `source-inventory.md`), `generated-docs/R3/` the corrected files, and
`generated-docs/PROVENANCE.md` records every claim with its disposition and repository evidence
(file:line at revision `27a40b2ce`): 58 claims — 6 REMOVED (the four confirmed errors plus the two
invented role names "Vessel Admin" / "Level 2 Reviewer" and the contradictory "only HOD / only
Vessel Admin" toggle rule), 24 CORRECTED, 13 NARROWED, 14 KEPT, 1 ADDED (the in-code 24 h badge vs
48 h "Stale" card inconsistency, stated so a reader is not misled). Rules applied: nothing is
described as a UI step unless the UI element was found (the whole-import Undo IS in the UI —
`UniformBulkUpload.tsx:200-202,640-642` — so it stays; the backend-only permission enforcement claim
was reduced to the routes that actually check roles); every R3 file opens with a "code-derived
documentation, revision R3, repository revision 27a40b2ce" note. The server's live corpus
(`~/central-assistant-py/documents/`) is untouched; the candidate was rebuilt from an isolated
copy (`documents-candidate/` = the 20 unchanged PDFs + the 5 R3 files). Rebuild
(`index-run-repaired-r3.txt`): 20 parses reused from the parse store, 5 new LlamaParse jobs for the
R3 files (job ids recorded; `metadata.version` still absent), repairs 3/3 applied, 41/41 xrefs,
855 vectors reused / 53 new, 908 chunks. Focused checks for the corrected claims:
`indexer/acceptance_generated.py` (`GEN_SUITE_VERSION 2026-09-14.1`, 14 cases, each requiring
the corrected statement and failing on the withdrawn wording, with a citation to the generated
document). Results: §S.6.2.

**S.6.2 — Final candidate verification (run D, 14-Sep-2026). DEPLOYMENT ON HOLD — owner's
explicit authorisation required.**
*Exact candidate:* index set `repaired` (911 chunks, 25 documents: 20 original manuals from the
saved parses + repairs 2026-09-14.1 + resolver 2026-09-14.4, and the 5 R3.1 generated documents,
sha256 prefixes bffa8828d516ab84 · d10f3027834959ef · e845a51f00a291ce · 0bb3e4225ed74fda ·
25f4a49ef951ccee), image `sail-assistant-py:prompt-v2` (8db669090d36), prompt
`v2-xref-hardrule-2026-09-14` (docs b37172f6122a0257 · tool-loop f8e5a8f86bede638 · combined
ebfd83a623e41173), embed `text-embedding-3-large:3072`, chunker `2026-03-17.original` 1200/150,
cleanup OFF, running as `sail-assistant-py-cand` on `127.0.0.1:8017`. Comparators: live 8015 (old
prompt, `migrated`, 907) and `sail-assistant-py-base` on 8016 (same image + prompt as the
candidate, `migrated`). Suites: 18-query retrieval; frozen 12-case suite `2026-09-14.3` (unchanged
since §S.6); corrected-claims suite `acceptance_generated.py 2026-09-14.2`. 3-run majority
everywhere. Raw outputs: `docs/assistant-experiments/2026-09-14-repairs/final-run-d.txt` + dumps.

| suite | live 8015 | base-v2 8016 | candidate 8017 |
|---|---|---|---|
| retrieval, 18 queries | 18/18 | 18/18 | **18/18** (identical distances) |
| frozen 12 cases, joint | 7/12 | 7/12 | **11/12** — no regression, gains 01/07/08/09 (each 3/3), same as §S.6 run B |
| corrected Technical claims, 14 cases | 5/14 | 2/14 | **13/14** |

*Corrected-claims suite, read against the sources (full answers in `acceptance-generated-dump.jsonl`):*
the four confirmed errors now answer correctly on the candidate and wrongly on live — Job Code
optional/auto-generated (live: "you must fill in the Job Code column, and it must be unique");
vessel code reaches a ship only through provisioning (live: refresh via master sync); Head of Dept
cannot do everything an office user can (live: "Yes"); amber = no sync for more than 24 hours,
time-based only (live: "or has changes waiting"). Narrowed claims answer with the R3 wording:
only a Sail Admin generates from the office and is told the switch is not enabled; one Sync Now
stops at 20 cycles / ~60 s / no progress; re-provision from Admin → Ship Provisioning; a lower
reading is refused with the back-dated exception (2/3 — one run gave the exception first); the
per-vessel switches live on 'Lead Time & Grace Period Settings'; Level 2 Reviewer is a per-job
rank field, not an assignable role (passes only with the R3.1 wording that names the PMS manual's
own section). **Test changes after run C, reported:** suite .1 → .2 fixed five judge defects of my
own (the must_not phrase for cases 07 and 10 was matched inside the correct negated answer; cases
02/04/14 demanded a citation to one generated document although the official PMS manual p63 or a
second R3 document carries the same statement; case 09 is answered by the official PMS manual
§1.1.3.4, which uses the term "Vessel Admin", so the case now requires the manual's answer). Run C
under suite .1: live 3/14, candidate 7/14 — kept in `final-run-c.txt`.
*Regression on the new suite, reported as measured:* case 04 (work-order number format) is ✓ on
live and ✗ on the candidate. The candidate's answer is correct and complete
(`<VESSELCODE>-<JOBCODE>-<COMPONENTCODE>-<YEAR>-<NNN>` / `<VESSELCODE>-UWO-…`, 3/3) but its top
citation is the Ship-Side notes, whose file name lacks the "(Operational)" substring the test
accepts — a test-string defect, left unchanged after the run rather than redefined; the Ship-Side
R3 text is itself a corrected source carrying that statement.
*R3.1 (post-audit wording change, reported):* run C showed the official PMS Office manual itself
says "Only Vessel Admin users can view and use the 'My Team' toggle" (p11) and titles §1.1.3.5 "How
to Approve Work Orders (Level 2 Reviewer Role)" (p12). Two R3 Roles sentences ("there is no
separate Vessel Admin role", "Level 2 review is not a role") were code-true but read as
contradicting the manual; R3.1 reconciles them (Vessel Admin profile role = treated as Head of
Dept; Level 2 Reviewer = the PMS manual's per-job rank field, not a user-assignable role). Only
the Roles document was rebuilt and re-parsed (job pjb-gr04veoal2e0upxc9k5sg9z6lkf4).
*Remaining limitations:* case 05 of the frozen suite (routing clarify gate, §S.6 — routing change
proposed, not made); the corrected-claims suite is a targeted check of the 14 corrected statements,
not a general measure; generated documents remain code-derived and say so in their first
paragraph; the official manuals still contain the "Vessel Admin" / "Level 2 Reviewer role" wording
(product-team documents, not touched).
*Recommendation:* verification passed (18/18 retained, 11/12 retained, no frozen-suite regression,
13/14 on the corrected claims). Recommend a **controlled rollout**: switch the public URL to the
candidate for the pilot tenant during working hours with the old container left running; watch
the assistant log (`gate`, `citations`) for one day; rollback = one nginx edit back to 8015.
*Rollback procedure (verified path):* `sudo sed -i 's#127.0.0.1:8017;#127.0.0.1:8015;#'
/etc/nginx/conf.d/assistant.conf` (and line 375 of `safelanes.conf`), `sudo nginx -t && sudo
systemctl reload nginx`; the old container `sail-assistant-py` (image e12c0b916d4c =
`sail-assistant-py:prompt-v1-rollback`, index `migrated`) never stops, and the `migrated` set stays
in the database untouched. Promotion = the same edits 8015 → 8017 (or recreate
`sail-assistant-py` from `:prompt-v2` with `ASSISTANT_INDEX_SET=repaired` and the same env file).

**S.6.3 — Pilot rollout GO (owner, 14-Sep) — pre-switch checks; STOPPED at check 2.**
*Check 1 (PASSED, recorded before any switch):* run D's candidate instance served index set
`repaired` with 911 chunks (`/health` at run start); DB: 25 documents, 911 chunk rows, one build
key for all 25 — `…|clean=off|xrefs=2026-09-14.4|repairs=2026-09-14.1|chunker=2026-03-17.original|1200/150|embed=llamaindex-meta9|model=text-embedding-3-large:3072`,
built 14-Sep 10:18–10:19 UTC; container image
`sha256:8db669090d3690111867ece75b868001bb6ee311e866456949a9f41618c133b9` (`sail-assistant-py:prompt-v2`);
prompt `v2-xref-hardrule-2026-09-14`, docs b37172f6122a0257 · tool-loop f8e5a8f86bede638 · combined ebfd83a623e41173.
*Check 2 (FAILED the owner's condition → no change made):* the public endpoint has no per-tenant
routing. `assistant.conf` is one `location /` → `127.0.0.1:8015` for `assistant.sl-sail.com`, and
`safelanes.conf` routes `viqmap.sl-sail.com/assistant/` the same way; the tenant is known only
inside the HMAC-signed identity header, which nginx does not decode. Flipping either `proxy_pass`
switches every tenant that reaches the endpoint. Tenant registry at this moment: 26 pairs across
11 tenant domains, all test identities from the build sessions (`smoke-suite-tenant`,
`stage2-test-*`, `parity-tenant`, `audit-tenant`, `public-proof-tenant`); 2,568 conversations, none
from a customer domain. No pilot tenant has used the assistant yet, so there is nothing in the
data that identifies "the pilot tenant". Options for the owner (not chosen by me): (a) accept the
global switch on the grounds that only test tenants exist today; (b) per-tenant routing without a
code change: nginx `map $http_origin` → upstream 8017 only for the pilot front-end origin
(`https://dev.sl-sail.com`, already the only non-local CORS origin), everything else → 8015 —
Origin is browser-set for the widget and only selects which container answers; (c) a small service
change that picks the index set per tenant domain (prompt would still be per container).

**S.6.4 — DEPLOYED to the shared endpoint, 14-Sep-2026 10:58 UTC (owner GO; replaces the
pilot-tenant-only restriction on the basis of verified test-only usage). Wider rollout still needs
the owner's separate approval.**
*What changed:* exactly two lines — the `proxy_pass` inside `assistant.conf` `location /`
(`assistant.sl-sail.com`) and inside `safelanes.conf` `location /assistant/`
(`viqmap.sl-sail.com/assistant/`), both `127.0.0.1:8015` → `127.0.0.1:8017`; `diff` against the
backups shows only those lines; `nginx -t` passed; graceful `systemctl reload nginx`. Backups:
`/etc/nginx/conf.d/assistant.conf.bak-8015-20260914105757`, `…/safelanes.conf.bak-8015-20260914105757`.
No other nginx rule, SSL setting, container, port or database was touched; a before/after snapshot
of every server_name (https + http status), the retired `/osm/` `/maran/` routes, SMS RAG on 8010,
every container's state and nginx's service state was byte-identical (`deploy-switch.txt`).
*Deployed identities (the run-D combination, together):* container `sail-assistant-py-cand` on
127.0.0.1:8017, image `sail-assistant-py:prompt-v2` = sha256 8db669090d3690111867ece75b868001bb6ee311e866456949a9f41618c133b9;
index set `repaired`, 911 chunks, 25 documents, one build key
`clean=off|xrefs=2026-09-14.4|repairs=2026-09-14.1|chunker=2026-03-17.original|1200/150|embed=llamaindex-meta9|model=text-embedding-3-large:3072`;
prompt `v2-xref-hardrule-2026-09-14` (docs b37172f6122a0257 · tool-loop f8e5a8f86bede638 ·
combined ebfd83a623e41173) — all three visible in the public `/health`. Signed-identity tenant
handling unchanged; no Origin routing, no per-tenant URLs.
*Post-deployment checks through the public endpoints (`postdeploy-*.txt`, dumps):*

| check | result |
|---|---|
| health, both public paths | `indexSet=repaired`, 911 chunks, db connected, prompt v2 hashes |
| authentication | no token 401 · malformed 401 · expired 401 · wrong-key 401; `/admin/` 403 publicly |
| tenant isolation | two fresh tenants self-register and answer; tenant A disabled via the tunnel-only admin API → gate `disabled` for A, B unaffected; conversations logged under their own tenant; A re-enabled |
| retrieval, 18 queries | 18/18 via assistant.sl-sail.com and 18/18 via viqmap…/assistant |
| frozen 12-case suite (.3), 3 runs | 11/12 — identical per case to run D; case 05 clarify (known) |
| corrected Technical claims (.2), 3 runs | 13/14 — identical per case to run D; case 04 = correct answer, citation-filename limitation kept as reported |
| clarification outcomes vs run D | per-case gates identical (12-case: 3 clarify runs = case 05 ×3; 14-case: 0) |
| logs since switch | service: 0 errors in 57 lines; nginx assistant error log: only the deliberate `/admin/pairs` 403 probe; global error log: only the snapshot probes of the retired `/osm/`/`/maran/` paths (404 before and after) |
| run-to-run splits | none |

*Observation outside the suites (not a regression, recorded):* "How do I create a work order?" with
Technical context answers with the unplanned-work-order steps on both old and new (the smoke suite
only checks routing/manual for that query).
*Remaining limitations:* case 05 (repaired content, routing clarify gate — routing change proposed
in §S.6, not made); corrected-claims case 04 kept at 13/14 until the Ship-Side citation is verified
against its supporting text; generated documents are code-derived and say so; official manuals'
"Vessel Admin" / "Level 2 Reviewer role" wording untouched.
*Rollback (immediate, one edit, nothing else moves):* the old container `sail-assistant-py`
(image e12c0b916d4c = `sail-assistant-py:prompt-v1-rollback`, index `migrated`, 907 chunks) is
still running on 127.0.0.1:8015 and the `migrated` set is untouched in the database.
`sudo cp /etc/nginx/conf.d/assistant.conf.bak-8015-20260914105757 /etc/nginx/conf.d/assistant.conf && sudo cp /etc/nginx/conf.d/safelanes.conf.bak-8015-20260914105757 /etc/nginx/conf.d/safelanes.conf && sudo nginx -t && sudo systemctl reload nginx`
(or `sed` 8017→8015 on the same two lines). Verify with `curl https://assistant.sl-sail.com/health`
→ `indexSet=migrated`, no `prompt` field.

**What this does NOT change:** the module-side Data API (Node, in Technical), the HTTP contracts,
the identity token format, nginx/TLS/URL, the masking design and its captured-payload proof
standard, the 30-tool coverage priority. The stack is chosen *for* those, not instead of them.
**Nothing merges to replit_dev; the module-side Data API (Node, inside Technical) is unaffected.**

The permanent name `assistant.sl-sail.com` (A record → 13.250.51.71) is still owner-pending;
the interim `https://viqmap.sl-sail.com/assistant` stands and the port keeps that URL working
throughout (§P4).

---

## Scope boundary — what is and is NOT ported

- **PORTED (the central service only):** `central-assistant/*.mjs` → a Python/FastAPI app
  (`central-assistant-py/`, on the §S stack). ~1,000 lines of my Node.
- **UNCHANGED — stays Node, lives in Technical:** `server/modules/assistant-api/` (manifest /
  execute / token-mint). It is a module concern, speaks HTTP/JSON, and the port only *calls*
  it. Zero Technical-app churn from this work.
- **UNCHANGED — infrastructure:** nginx + TLS, the interim URL, Postgres data, the identity
  **token wire-format** (HMAC-SHA256 — reimplemented in Python, byte-compatible so existing
  tokens verify across both). The knowledge store is the one infra item that CAN change: §S
  proposes pgvector in place of the Chroma container (the 907 chunks re-load from the staging
  folder + existing embeddings; ~minutes, not a re-index).

## P1 — What moves AS-IS (carries over unchanged, no re-derivation)

| Asset | Why it carries |
|---|---|
| The 907 chunks + their embeddings | language-agnostic; carried into whichever store §S settles on (pgvector proposed; Chroma if declined) |
| Postgres schema + all SQL (pairs matrix, conversation log, ratings, notifications) | same DB, same tables; Python `psycopg`/`asyncpg` runs the same SQL |
| nginx `/assistant/` block, TLS, interim URL, CORS origins | untouched; the port swaps only what listens on `127.0.0.1:8012` |
| HTTP tool contracts (manifest/execute/token JSON shapes) | the wire is the contract — Python calls them identically |
| Identity token **format** (payload + HMAC + 90 s skew leeway) | reimplemented in Python, wire-compatible both directions |
| Prompts, routing thresholds (SIM_FLOOR, ROUTE_MARGIN), budgets (10 s/30 s/90 s) | copied as config constants |
| The HTTP test suites (smoke/stage2/parity/masking) | they are HTTP clients — they re-prove the Python service almost unchanged |

## P2 — What is REWRITTEN (mechanical, not conceptual)

| Node file | Python home | Notes |
|---|---|---|
| `server.mjs` (http.createServer, routes, gates) | `app/main.py` (FastAPI routers) | endpoints identical: POST /chat, /rate, GET /health, /admin/*, GET / landing |
| `db.mjs` (pg.Pool) | `app/db.py` (asyncpg pool) | **pool max raised 5 → 20 here — Audit 4 fix lands in the port** |
| `identity.mjs` | `app/identity.py` | HMAC + skew leeway; wire-compatible |
| `rateLimiter.mjs` | `app/ratelimit.py` | see §P6 — Postgres-backed, not in-memory (Audit 4) |
| `masking.mjs` | `app/masking.py` | same choke-point design + fail-closed; masking suite re-proves with captured payloads |
| `toolLoop.mjs` (hand-rolled while-loop) | `app/agent.py` — **Pydantic AI agent** with typed tools built from each module's manifest | budgets enforced around the agent run; **Audit 3 per-tool coverage built against this** |
| `notify.mjs` | `app/notify.py` | durable-record-only (email already dropped) |
| (retrieval inside `server.mjs`) | `app/retrieval.py` — hybrid (vector + full-text) query, then **BGE reranker** on top-20 | the retrieval-quality upgrade lands here; routing thresholds re-measured on the smoke suite |

Retrieval/embedding/LLM calls go through the Pydantic AI model adapter (OpenAI today; Anthropic/
Bedrock is a config change) — not raw `openai` SDK calls scattered through the code.

## P3 — What PROVES the port (same bar as today, re-run on Python)

Every existing suite must pass against the Python service on the pilot, plus the new coverage:
- Stage 1 smoke (routing 0/18) · Stage 2 (identity/kill-switch/registration/rate-limit/log)
  · Stage 3 parity (scope refusals verbatim) · Stage 5 masking (captured outbound payloads,
  zero identifiers) · tsc N/A (Python: `ruff` + `mypy` clean).
- **Audit-3 per-tool suite (the priority, §T):** all 30 tools.
- **Audit-4 load measurement (§L):** the numbers we currently lack.

## P4 — Keeping the service LIVE on the interim URL during the switch

No blackout. The Python service is stood up on a **different local port (8015 — not 8013/8014:
`safelanes.conf` still routes the retired v1.5 bots' `/maran/*` and `/osm/*` paths there)**
beside the running Node one (8012); nginx keeps pointing at 8012. When the Python service
passes the full suite on 8015, a **one-line nginx `proxy_pass` change 8012 → 8015 + reload** cuts over
atomically; the Node container stays warm for instant rollback (flip the line back). Once the
Python service has run clean for the pilot window, the Node container is retired. Same
lever-based approach we used for the graphai→viqmap move.

## P5 — Sequence (owner-set order: port → coverage → pilot fixes → console)

**Stage 5-PORT — Python/FastAPI rewrite** *(M, ~3–5 d)* — **as few simultaneous changes as possible**
> **STATUS 11-Sep-2026 (PROVEN):** built (`central-assistant-py/`), running on the AI server at
> `127.0.0.1:8015` beside Node on 8012. `sail-assistant-db` swapped to `pgvector/pgvector:pg16`
> (restored from dump; alpine container kept stopped for rollback); 907/907 chunks migrated
> (per-module tally identical). Re-proven on Python: smoke 18/18 (0 misrouted, matrix identical) ·
> stage2 16/16 (Postgres limiter exact 5-of-35) · parity 22/22 · redirect gate 3/3 zero-LLM ·
> captured OpenAI wire 0/18 real fleet names, 68 tokens · pytest 28 · ruff/mypy clean.
> **CUT OVER 11-Sep 10:13 UTC (owner GO):** nginx `/assistant/` → 8015 (conf backed up as
> `safelanes.conf.bak-cutover-py-20260911-1013`), proven from the public URL over real DNS
> (`/health` → `store: pgvector, 907 chunks`; admin 403; unsigned chat 401). Node container kept
> warm on 8012 for instant flip-back. Dedicated key: not yet received.
> **PERMANENT HOME LIVE 11-Sep 11:02 UTC:** owner created the A record; `assistant.sl-sail.com`
> now serves the service (own nginx conf `conf.d/assistant.conf`, Let's Encrypt cert to
> 2026-12-10, renewal dry-run OK), proven from the public internet: health, landing 200, admin
> 403, unsigned 401, http→https 301, TLS chain valid. Widget default + API doc moved to it; the
> interim viqmap path stays up during the transition.

**§G — Stage 5 gap, on the record (found during the port, closed by it).** The Stage 5 claim
"nothing identifying reaches OpenAI" was **narrower than it read** for the docs-only path: the
Node service masked the *embedding* input, but `answer()` sent the **raw user question** (plus
the manual excerpts) to the chat completion unmasked — only the tool-loop path went through the
masking choke point. A question that named the context vessel or the user therefore left
unmasked on the documentation path. Evidence class: READ (server.mjs `answer()` built its own
fetch with no masker call). The Python service has ONE choke point for both paths
(`MaskingModel.request`), so the docs path is masked by construction; the proof is
`central-assistant/docs-masking-suite.mjs` — captured wire bodies for a docs-only turn (no module
API) must show the embedding input AND the chat question masked, with the real name restored to
the user. Node is not fixed (retires at cutover; nobody on the interim URL — owner decision).
Day one: §S.1 spike → decision. Then port P2; carry P1; pgvector rides along (§S.2) because
retrieval is rewritten anyway; **dedicated OpenAI key installed here, borrowed key retired**;
stand up on :8013; all existing suites green on Python; nginx cutover; Node retired after the
pilot window. Exclusions (§X) implemented here: purchasing + noon-report redirects, routing-miss
fix. **NOT in the port:** the reranker, the console, any new AI library beyond §S.

**Stage 5-RERANK — reranker as its own measured step** *(S, own step, after the port)*
BGE-Reranker-v2-m3 self-hosted; smoke-set retrieval numbers captured BEFORE (Python+pgvector,
no reranker) and AFTER, same queries, same day; report model size, RAM and CPU latency per
query; adopt only on a measured gain. *Ordering note: owner said "immediately after the port"
AND "per-tool coverage outranks everything" — listed here after 5-TOOLS on the second rule;
flip if the first was meant literally.*

**Stage 5-TOOLS — per-tool coverage (THE PRIORITY)** *(M, ~1–2 d, §T)*
All 30 tools: scope test with a Ship identity, smoke, and a masking assertion with captured
payloads. Any tool that cannot restrict to the caller's vessel is **must-fix or disabled before
pilot** — disabled is acceptable, leaking is not. Deliverable: a coverage table (tool × tested ×
scope-safe × masking-clean) for you.

**Stage 5-SCALE — pilot fixes** *(S–M, §L)*
Pool max 20 (done in the port), Postgres-backed rate limiter (done in the port), OpenAI 429
handling (detect/back-off/"busy" message), and the load measurement (10/25/50 concurrent →
p50/p95, 429s, pool-wait). Split: these four are "before real users"; horizontal-scale and
caching stay "later".

**Stage 6 — admin console** *(M–L, unchanged scope, now built in Python)* — only after the above.

**Stage 7 — second module Data API** *(per-module, unchanged)*.

## P6 — Decisions/inputs I need from you along the way (surfaced now, not later)

1. ~~The stack — §S, row by row.~~ **RULED 11-Sep** — see the status column; open condition =
   the §S.1 spike verdict (reported as a decision on day one).
2. ~~Rate limiter store~~ **RULED — Postgres.**
3. **The dedicated OpenAI key** (`sail-assistant`, embedding + gpt-4o-mini) — **install during
   the port, retire the borrowed one** (owner 11-Sep). *File, not chat, when ready.*
4. **`assistant.sl-sail.com` A record** — in hand; owner will say when it resolves. Cutover and
   permanent-URL move then happen together.
5. **Masked-only logging default** — owner decides **before any client goes live, not before
   the port**.
6. **Standing rule reaffirmed (11-Sep):** it covers containers and databases as much as
   languages — `sail-assistant-db` was the second infrastructure decision to arrive as a
   build-report line. Nothing to undo; the rule is the takeaway.

## X — Deliberate EXCLUSIONS (not gaps — record, revisit by status)

- **Purchasing** — Shipskart is a third-party product with its own in-module assistant. **Do
  not index.** Refusal changes from "not documented" to a **redirect**: "Purchasing is handled
  in the Shipskart module, which has its own assistant." Same treatment for any other
  third-party surface found.
- **Noon Report** — module **not functional yet**; nothing to document. **Excluded-by-status.**
  Refusal says "the Noon Report module is not available yet," not "not documented." Also fix the
  routing miss: "noon report" must not route to Incident before refusing. **Revisit when the
  module goes live.**
- Both implemented as a small **known-redirect table** in the router (term → message), checked
  before the not-documented gate, so the response is useful and correct rather than a bare
  refusal.

## T — Per-tool coverage detail (Audit 3, the priority)

30 tools; today only 6 are exercised. For **each** tool:
- **Scope (the one that matters):** call with a Ship-role signed identity for vessel A, assert
  it returns only A's data or refuses — never B's, never fleet. Fleet-shaped analysis tools
  (`get_recurring_defect_analysis`, `get_workload_forecast`, `get_equipment_comparison`,
  `get_fleet_overview`, `get_cost_impact_estimate`) get an explicit "does a Ship user get other
  vessels?" assertion. **Cannot restrict → must-fix or disable before pilot.**
- **Smoke:** returns well-formed data on a seeded vessel, no crash.
- **Masking:** captured outbound payload after the tool result rejoins the prompt contains no
  unmasked vessel/person/IMO/UUID (Stage-5 standard, per tool).
Deliverable: the tool × (scope-safe / smoke / masking-clean / DISABLED) table.

## L — Load measurement (Audit 4)

Scripted N-concurrent clients (10/25/50) against the pilot: p50/p95 latency, OpenAI 429 count,
pg pool-wait. Establishes the real ceiling before a real-user pilot rather than guessing.
Expected first limits (to confirm, not assume): OpenAI rate limits, then the pool.

---

*Planning only. The one irreversible-ish step (nginx cutover) is lever-based with the Node
container kept warm for rollback; nothing else changes infrastructure. No merge to replit_dev.*
