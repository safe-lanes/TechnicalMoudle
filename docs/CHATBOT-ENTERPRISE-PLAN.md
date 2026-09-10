# Technical-Module Chatbot — Enterprise Upgrade Plan

**Status:** Final consolidated roadmap (supersedes the investigation series)
**Branch:** `replit_dev` @ `ac938c97b`
**Audience:** Safe Lanes engineering + product/founder
**Scope of this doc:** planning only — no code changes. References the production **SMS RAG** and the `feature/multi-tenancy` branch read-only for reuse patterns.

---

## 1. Executive summary

**What the chatbot is today.** Embedded in the Technical module, it answers users' questions about their maintenance data. Under the hood it's OpenAI **GPT-4o** with **30 read-only tools** that pull live data (work orders, spares, defects, running hours, certificates). It's genuinely good at *data* questions ("what's overdue on this vessel?") and it is **read-only** — it never changes records.

**The two core problems.**
1. **It makes up "how-to" answers.** For procedural questions ("how do I create a work order?", "how does sync work?") it has *no grounding* — it answers from the AI model's general knowledge, so it can sound confident but be wrong for *our* product.
2. **It sends client data to OpenAI.** Every data question ships live vessel data to a third party. As we go multi-tenant, that's client data leaving our boundary.

**What this plan delivers.**
- **Truthful how-to answers** — the bot answers procedural questions **only** from our real Technical manuals + operational guides (RAG grounding), **with citations**, and says "not documented" rather than guessing.
- **Data protection** — sensitive names/IDs are **masked before** anything reaches the AI and **restored after**, so the model only ever sees placeholders while the user still sees real names. Plus an optional switch to **Amazon Bedrock** (AWS) to keep data inside our cloud boundary.
- **Operability** — a **Safe Lanes internal admin console**: read every conversation, rate answer quality, manage the knowledge docs (upload → auto-index), and see **LLM spend per client** and overall.
- **Control & safety** — per-client on/off switch, rate limits, bounded/cheaper AI usage, timeouts, and enforcement that a user only queries vessels they're allowed to.
- **A path to Phase 2** — the architecture is built so a later "walkthrough / do-it-for-me" agent plugs in without a rewrite.

Non-engineer summary: *today the assistant is smart about your data but can bluff on "how do I…" questions and it talks to an outside AI. This plan makes it answer only from our real manuals (and admit when it doesn't know), hide personal/vessel names from the outside AI, and gives Safe Lanes a private dashboard to watch quality and cost and keep the manuals current.*

---

## 2. Coverage table — every original finding is addressed

| # | Finding from the investigation series | Where addressed | Status |
|---|---|---|---|
| 1 | **Hallucination on how-to** (ungrounded) | Stage B — RAG grounding + `search_module_docs` + refuse-when-undocumented | ✅ **grounding tested & proven** (indexer spike on the real manuals + gap docs — right sections retrieved) |
| 2 | **No citations / provenance** | Stage B — cited answers from retrieved chunks | ✅ |
| 3 | **Data egress to OpenAI** | Stage B — mask-out/un-mask-in; **+** Bedrock track (data in AWS) | ✅ |
| 4 | **Data privacy** (sensitive fields to external LLM) | Stage B — masking; Bedrock track | ✅ (residual: free-text scrubbing — see §6/§7) |
| 5 | **No rate limiting** | Stage A — operational hardening | ✅ |
| 6 | **Unbounded/expensive tool-loop** (up to 9 GPT-4o calls/msg) | Stage D — bounded + cost-capped + cheaper planning model | ✅ |
| 7 | **Token optimization** | Stage D — trim payloads (masking already strips IDs), summaries over row-dumps, model tiering | ✅ |
| 8 | **No request timeout / reliability** | Stage A — timeout + retry/backoff + graceful fallback | ✅ |
| 9 | **Observability = console logs only** | Stage A — central log store; Stage C — admin viewer | ✅ |
| 10 | **No per-tenant enable/disable** | Stage A — `ai_enabled` flag, checked before any LLM call | ✅ |
| 11 | **Within-tenant vessel-scope not enforced** (LLM-supplied `vesselId`) | Stage A — server-side scope enforcement in the tool layer | ✅ |
| 12 | **No cost controls / attribution** | Stage A — per-tenant token budget; Stage C — per-tenant cost view | ✅ |
| 13 | **Conversation persistence** (history is client-supplied, not stored) | Stage A — central log store persists every turn (thread via `conversation_id`) | ✅ |
| 14 | **No caching** (repeat questions re-run the full loop) | Stage D — optional response/retrieval cache (nice-to-have) | ✅ (nice-to-have) |
| 15 | **MT tenant-safety fragile if streamed later** | Design guardrail — no streaming without tenant-context re-entry (honored in Phase 2 seam) | ✅ constraint |
| 16 | **Manual coverage gaps** (bulk import, roles, sync, ship-side) | Stage B — index the 4 drafted gap docs | ⚠️ pending Jeevan label verification |
| 17 | **Purpose mismatch** (weakest at how-to) | Stage B (grounding) + Phase 2 (walkthroughs) | ✅ |

**Nothing from the original investigation is dropped.** Two carry a flag: **#4** (free-text like defect descriptions may still contain names → add a scrubber + test) and **#16** (gap-doc wording pending verification).

*Note on tenant-safety:* the current bot is already **tenant-safe by construction** (reads route through the tenant-aware DB accessor, inline, no context-dropping boundary) — this plan preserves that and adds the guardrail (#15).

---

## 3. Phase 1 — Enterprise baseline

Grouped into four stages. Effort: **S** ≤ ~2 days · **M** ~3–5 days · **L** ~1–2 weeks (indicative).

### Infrastructure (finalized, applies to Stages B & C)
- **Reuse the proven Python SMS-RAG *unified* indexer** (`indexer_unified_refactored.py`) — it handles **PDF + DOCX + HTML** (PDFs via LlamaParse), with the same **3-stage commit + audit** integrity mechanism. *Note:* the older HTML-only "section-wise" indexer does **not** fit the PDF manuals — the unified indexer is the correct tool. Run as a **separate instance for Technical**, never against SMS data.
- **✅ Validated by a spike on the actual docs** (`D:\manuals\Technical module` — 3 PDFs + the 4 markdown gap docs): all 7 docs indexed cleanly (~92 chunks after de-dup¹), the PDFs extracted into well-structured **sectioned markdown** via LlamaParse (section titles preserved as chunk metadata), chunking was coherent, and a retrieval smoke test ("create a work order", "bulk import", "how sync works") returned the **right sections**. The RAG grounding therefore rests on tested fact, not assumption. *(¹ raw run produced ~174 PDF chunks at the spike's chunk size; treat the exact count as tunable via chunk size.)*
- **Separate ChromaDB collection/instance** for Technical, isolated from the SMS RAG. **Same embedding model on both sides** (`text-embedding-3-large`, as used in the spike).
- **Deploy as its own Docker container(s) on the existing Ubuntu AI server.** Technical RAG is **small (~10 operational docs)** → lightweight; Docker gives automatic data/environment/lifecycle isolation so it **cannot disturb production SMS RAG**. No dedicated server; resource limits optional (size makes them near-unnecessary).
- **Global docs:** one shared Technical collection for all tenants (the manuals are identical for everyone). No per-tenant doc routing. **Node-side retrieval** (the chatbot's `search_module_docs` tool queries this collection; indexing is the Python container's job).

**Known trade-offs (observed in the spike, accepted):**
- **PDF parsing uses LlamaParse (external cloud)** — a **one-time, per-document step at *indexing* time** (NOT per user question). Acceptable for **generic module manuals** (no tenant data), but it needs the **`LLAMA_CLOUD_API_KEY`** and awareness that the manual PDFs are uploaded to LlamaCloud for parsing. (Embeddings likewise go to OpenAI at index time.)
- **Screenshots become text descriptions, not preserved images** (LlamaParse describes each screenshot's steps in prose) — fine for a **text** chatbot that explains steps rather than showing the actual screenshot.
- **Minor extraction imperfections** (occasional smart-quote/heading/table quirks) — cosmetic; **did not break retrieval** in the smoke test. An optional cleanup pass can polish them.

### Stage A — Foundation quick-wins (make it safe & controllable)
| Step | What it does (plain language) | Depends on | Reuse vs build | Effort |
|---|---|---|---|---|
| A1 | **Per-tenant on/off** — `ai_enabled` flag on the master tenants registry; checked before any AI call; single-tenant env fallback. | — | Build (small) | **S** |
| A2 | **Vessel-scope enforcement** — the server checks the user may only query their assigned vessels; the AI can no longer be steered to another vessel via a supplied ID. | — | Build (small) | **S** |
| A3 | **Reliability** — timeout + retry/backoff on the AI call; keep the graceful "try again" fallback. | — | Build (small) | **S** |
| A4 | **Rate limiting** — per-user/session limits to stop abuse/runaway cost. | — | Build (small) | **S** |
| A5 | **Central log store** — record every turn (tenant, user, question, **full answer**, tools used, docs retrieved + citations, tokens, cost, latency) in a **central Safe Lanes ops store keyed by tenant**, written **after** the reply is sent (never slows the answer). Foundation for the admin console + cost view. | — | Build | **M** |

### Stage B — Grounding + data protection (fix the two core problems)
| Step | What it does | Depends on | Reuse vs build | Effort |
|---|---|---|---|---|
| B1 | **Index the knowledge** — extract, section-chunk, embed the **3 manuals + 4 gap docs** into the separate Technical ChromaDB, via the reused **unified** Python indexer (PDF/DOCX/HTML) in its Docker container. **✅ Indexer choice validated by spike** (all 7 docs indexed, coherent sectioned chunks, retrieval returned the right sections). | Jeevan verification (#16); infra up | **Reuse** SMS unified indexer/Chroma/audit (proven); **build** the upload→index wiring + admin front-end | **M** |
| B2 | **Ground how-to answers** — add a `search_module_docs` retrieval tool; the bot answers procedural questions **only** from retrieved chunks **with citations**, and says "not documented" otherwise. Data questions keep using the existing tools. | B1 | Build (tool + prompt rules) | **M** |
| B3 | **Mask-out / un-mask-in** — before anything reaches the AI, strip DB IDs and replace vessel/person names with placeholders (Vessel-1, Person-A), keeping a per-request map that survives the whole tool-loop; after the AI answers, restore the real names in the text. Deep-links rebuilt server-side. | — | Build | **M** |

### Stage C — Internal admin console (Safe Lanes only)
Single **internal platform-admin** surface, **full cross-tenant visibility, no client access.**
| Step | What it does | Depends on | Reuse vs build | Effort |
|---|---|---|---|---|
| C1 | **Chat-log viewer + quality rating** — list/filter/search conversations (by tenant, date, rating, flagged); open a full thread showing tools + docs used; **end-user 👍/👎** and **admin good/bad/needs-review + note**. | A5 | Build (UI + endpoints) | **M** |
| C2 | **RAG doc manager** — admin uploads a doc (PDF/MD/DOCX) → **auto-extract → chunk → embed → commit** to the Technical collection (no scripts); **list of indexed docs** (name, updated, chunk count, status); replace/remove via the SMS audit pattern (no orphan/dup chunks). | B1 | **Reuse** SMS manifest/audit; **build** upload endpoint + UI | **M–L** |
| C3 | **Per-tenant cost view** — roll up the log rows into **spend per tenant + overall totals + trend over time**; feeds the enable/disable decision. | A5 | Build (rollup + UI) | **M** |

### Stage D — Optimization (tighten cost/perf once it's live)
| Step | What it does | Depends on | Effort |
|---|---|---|---|
| D1 | **Bounded + cheaper tool-loop** — hard token/cost ceiling with early stop; use a cheaper model for tool-planning, reserve the top model for final synthesis. | A5 (to measure) | **S–M** |
| D2 | **Token trimming** — send summaries/aggregates instead of row-dumps where possible (masking already strips IDs). | B3 | **S** |
| D3 | **Caching (nice-to-have)** — cache retrieval/answers for repeated identical questions. | B1/B2 | **S–M** |

### Independent track — Bedrock migration (optional, flag-gated)
Swap the AI provider to **Anthropic Claude on Amazon Bedrock** behind a `LLM_PROVIDER` flag: the 30 tool definitions are reused as-is; only the client + the ~30-line call/loop formatting change. **Keeps data inside our AWS boundary.** Slots in **anytime** — independent of A–D, and complements B3 on the data-privacy goal. Effort **M**.

---

## 4. Phase 2 — Actionable / walkthrough agent (later)

Clearly a **later** phase; Phase 1 is designed so this is **additive, not a rewrite**.
- **Capability-registry seam:** the tools become a registry of capabilities tagged `read` / `doc` / `action` / `walkthrough`. Phase 1 registers `read` + `doc`; Phase 2 adds the rest — masking + logging wrap every capability uniformly.
- **Walkthroughs from manual steps:** the per-section RAG chunks (already the how-to steps) drive interactive, step-by-step guidance ("next / confirm", deep-link to the right screen).
- **Safe action pattern — propose → confirm → execute:** the bot *proposes*, the user *confirms*, the server *executes* through existing module services (never raw, never AI-direct), with mandatory guardrails: confirmation, server-side auth/role, tenant-safety (context re-entry), audit log, idempotency.

---

## 5. Recommended build order

1. **Start immediately, in parallel:**
   - **Stage A quick-wins (A1–A4)** — small, high-value safety/control; no dependencies.
   - **A5 central log store** — foundation for the admin console and cost view.
   - **Infra setup** — Docker container + separate ChromaDB on the Ubuntu AI server (unblocks Stage B/C).
2. **Then Stage B (B1 → B2 → B3):** grounding is the headline fix. B1 needs Jeevan's verification + infra; B3 (masking) can proceed in parallel with B1/B2.
3. **Then Stage C:** C1 + C3 depend on A5; C2 depends on B1. Largest, purely additive/admin-scoped.
4. **Stage D:** after it's live and measured.
5. **Bedrock track:** anytime in parallel (optional).
6. **Phase 2:** only after the Phase 1 baseline is trusted in production.

---

## 6. Prerequisites / dependencies before starting

- **Jeevan — gap-doc verification:** confirm the on-screen labels/wording in the 4 drafted operational gap docs (Bulk Import, Roles & Permissions, Sync-operational, Ship-Side), especially **Roles & Permissions**, before indexing (B1). *Blocks B1.*
- **Sahil — OpenAI DPA (in progress):** the data-processing agreement covering data sent to OpenAI. Relevant while OpenAI is the provider; the Bedrock track reduces this exposure. *Not a hard blocker for Stage A; relevant to B/production.*
- **Infra setup:** provision the Docker container(s) + separate ChromaDB instance/collection on the existing Ubuntu AI server; confirm the reused **unified** Python indexer runs there in isolation (the spike already proved it works on these docs locally). *Blocks B1/C2.*
- **LlamaParse API key + external-parsing awareness:** the PDF manuals are parsed via **LlamaParse (LlamaCloud)** at index time — provision the **`LLAMA_CLOUD_API_KEY`** and note that the (generic, non-tenant) manual PDFs are uploaded to LlamaCloud for parsing. One-time per document, not per query. *Blocks B1.*
- **Free-text scrubbing decision (residual #4):** agree how aggressively to redact names from free-text (defect/WO descriptions) before egress — light scrubber + test vs stricter redaction.

---

## 7. Explicitly OUT of scope (prevent scope creep)

- **Technical-internals documentation** — the bot explains *how to use* the module, never engineering internals (sync-engine mechanics, DB/constraint/migration details, architecture).
- **Multi-tenancy documentation** — internal plumbing; never user-facing. Excluded from the knowledge base entirely.
- **Client-facing admin** — the admin console (logs, doc manager, cost view) is **Safe Lanes internal only**. No client/tenant ever sees it. No two-level/tenant-admin model.
- **Per-tenant documentation** — the knowledge docs are **global** (same for all clients). No per-client doc sets or routing.
- **Write/actions in Phase 1** — the bot stays **read-only** until Phase 2's guarded action pattern.

---

*End of plan. No code changes made; this is a planning document only.*
