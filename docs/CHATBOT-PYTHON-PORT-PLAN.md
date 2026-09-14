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
