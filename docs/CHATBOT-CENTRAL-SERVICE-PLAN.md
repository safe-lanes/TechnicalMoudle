# SAIL AI Assistant — Central Service Plan (Module-Agnostic Chatbot)

**Status:** Planning, **rev 2 after product-owner review 09-Sep** (identity signing from day one · module×tenant matrix · routing failure mode · budget reconciliation · effort caveat · log retention · DPA as go-live blocker) — extends `CHATBOT-ENTERPRISE-PLAN.md` (Phase 1 stages A–D remain valid; this document relocates WHERE they run and adds the cross-module architecture)
**Written from:** `feature/chatbot-enterprise` @ `7a958fc53` (09-Sep-2026), knowledge store as rebuilt 09-Sep (231 chunks)
**Audience:** Safe Lanes engineering (Technical, Crewing, Audit, Safety module teams) + product
**Author basis:** the "What exists today" section is a complete code investigation of the live Technical chatbot module (evidence class READ, with the Stage A gates PROVEN on the pilot 09-Sep).

---

## 1. The vision (product owner, 09-Sep-2026)

1. **One chatbot, written once, embedded everywhere.** The chatbot is developed and deployed
   **independently of the modules**, on the AI server where the knowledge index lives. Technical,
   Crewing, Audit and Safety embed the same assistant — no per-module chatbot development.
2. **Module-agnostic answers by intent.** A user asks a question; the assistant works out which
   module it concerns and answers from that module's documentation.
3. **In-app walkthroughs (later phase).** The assistant can guide a user step-by-step inside the
   module screen. This requires a local presence in each module — satisfied by the embedded
   widget, not by a per-module bot.

## 2. Target architecture

```
                     ┌───────────────────────────────────────────────┐
                     │        AI SERVER (pilot: 13.250.51.71)        │
                     │                                               │
   SAILERP shell     │  ┌─────────────────────┐   ┌───────────────┐  │
  ┌──────────────┐   │  │ SAIL AI ASSISTANT   │   │ ChromaDB      │  │
  │ chat WIDGET  │──▶│  │ SERVICE (central)   │──▶│ knowledge     │  │
  │ (mounted     │   │  │ · intent routing    │   │ store         │  │
  │  ONCE in the │   │  │ · LLM orchestration │   │ (per-module   │  │
  │  shell, so it│   │  │ · RAG retrieval     │   │  tagged docs) │  │
  │  appears in  │   │  │ · masking           │   └───────────────┘  │
  │  ALL modules)│   │  │ · rate/toggle/log   │                      │
  └──────────────┘   │  └──────────┬──────────┘                      │
                     └─────────────┼─────────────────────────────────┘
                                   │  Assistant Data API calls
                                   │  (per module, OPTIONAL, read-only)
              ┌────────────────────┼──────────────────┬───────────────┐
              ▼                    ▼                  ▼               ▼
        ┌───────────┐        ┌───────────┐      ┌───────────┐   ┌───────────┐
        │ TECHNICAL │        │  CREWING  │      │   AUDIT   │   │  SAFETY   │
        │ data API  │        │ data API  │      │ data API  │   │ data API  │
        │ (exists as│        │ (when     │      │ (when     │   │ (when     │
        │ 30 tools) │        │  wanted)  │      │  wanted)  │   │  wanted)  │
        └───────────┘        └───────────┘      └───────────┘   └───────────┘
```

**Three pieces:**

- **Central service** — owns everything module-agnostic: the LLM tool-loop, intent routing,
  documentation retrieval (RAG) with citations, masking, per-tenant on/off, rate limiting,
  timeouts, the central conversation log, and (later) the admin console and walkthrough engine.
  The Stage A machinery already built in the Technical module moves here (the logic and much of
  the Node/TS code is portable).
- **Shared widget** — one embeddable chat UI. Because every module is an MFE inside the SAILERP
  shell, the widget can be mounted **once in the shell** and appear in all modules automatically.
  It passes the user's context (module, current page, vessel) with each message. It is also the
  local presence the Phase-2 walkthroughs need (highlight, deep-link, step through).
- **Per-module Assistant Data API** — OPTIONAL, only for modules that want **live-data answers**
  ("what's overdue on Gas Mia?"). How-to answers need nothing from a module. Spec in §5;
  development guide in §6. Technical's existing 30 tools become the reference implementation.

**What each kind of question touches:**

| Question type | Central service | Module involvement |
|---|---|---|
| How-to ("how do I create a work order?") | RAG over that module's manuals, cited answer | **None** |
| Live data ("what's overdue on Gas Mia?") | Orchestrates, masks, answers | Module's Assistant Data API answers the data call |
| Walkthrough ("show me how, on screen") | Drives the steps from manual sections | Widget in the module highlights/deep-links (Phase 2) |

## 3. What exists today — complete investigation of the Technical chatbot module

*Evidence: READ from code on `feature/chatbot-enterprise` @ `7a958fc53`; the Stage A gates were
PROVEN live on the pilot 09-Sep (endpoint answers, rate limiter fires on the 31st request).*

### 3.1 Surface and contract

- **One endpoint:** `POST /technical/api/chat` (`server/modules/chatbot/routes.ts`, guarded by
  `requireAuth`; handler `server/modules/chatbot/controllers/chatbotController.ts`).
- **Request body:** `{ message: string, conversationHistory?: ChatMessage[], context?:
  { vesselId, vesselName, currentPage }, conversationId?: string }`. History is client-supplied
  (stateless server) — the central service inherits this contract initially.
- **Response:** `{ response: string, toolsUsed: string[], conversationHistory: ChatMessage[],
  usage?: { tokensIn, tokensOut } }`. Errors are returned as HTTP 200 with a clean in-chat
  message (the widget throws on non-200) — rate-limit, disabled-tenant and LLM-failure cases all
  follow this pattern.

### 3.2 Identity and tenancy (what the bot knows about the caller)

- `requireAuth` populates `req.user` from the SAILERP-forwarded identity headers: **role**
  (`x-user-role`), **full name**, **user id**, and (for ship users) an assigned **vesselId**.
- Tenant identity (`tuid`, `domain`) comes from the multi-tenant context when MT is enabled;
  `null` single-tenant.
- **This is the crucial dependency for centralization:** everything the bot does is scoped by
  who is asking. The central service must receive this identity with every request, verifiably
  (§5.3).

### 3.3 The Stage A gates (run BEFORE any LLM call, in order)

1. **Rate limit** — per-user sliding window (`rateLimiter.ts`; `CHATBOT_RATE_MAX` default 30 per
   `CHATBOT_RATE_WINDOW_MS` 60s; ≤0 disables). Over-limit → clean 200 message, zero LLM cost.
2. **Per-tenant on/off** — MT: `tenants.ai_enabled` via `isTenantAiEnabled(domain)` (fail-open);
   single-tenant: `CHATBOT_ENABLED` env (default on). Off → clean 200 message, zero LLM cost.
3. **After the reply:** fire-and-forget write to the central `chatbot_interactions` log (master DB
   in MT, main DB single-tenant — never a tenant DB): tenant, user, question, full answer, tools
   used, tokens, latency, model/provider. Never awaited; failures never break the answer.

### 3.4 The LLM loop (`server/services/chatbotService.ts`, `processChatMessage`)

- Model **gpt-4o**, OpenAI SDK, with `CHATBOT_TOOLS` (30 function tools).
- Bounds: **max 8 tool iterations**, **60 s per LLM call** (`LLM_TIMEOUT_MS`), **120 s total
  wall-clock budget** (`LLM_TOTAL_BUDGET_MS`); graceful "having trouble connecting" fallback on
  any failure.
- System prompt carries the chat context (vessel, page, user role + name).

### 3.5 Vessel-scope enforcement (inside `executeTool`, before any DB read)

- Gated by `CHATBOT_ENFORCE_VESSEL_SCOPE` (default on). The LLM supplies `args.vesselId` — it is
  **never trusted**: `canAccessVessel(access, vesselId)` (in `middleware/auth.ts`) allows
  Office / PMS Admin / Sail Admin any vessel; a **Ship** user only their assigned vessel.
- `get_fleet_overview` is refused outright for Ship users.
- Denials return an **error object as tool output** (the LLM explains it politely) — not an HTTP
  error. This pattern carries into the Data API spec (§5.6).

### 3.6 Complete tool inventory (30 tools, all read-only)

All execute in-process against the storage layer; `vesselId` is the near-universal first
parameter. Grouped by what they read:

| Group | Tools |
|---|---|
| Work orders | `get_work_orders` · `get_work_order_detail` · `get_overdue_work_orders` · `get_due_work_orders` · `get_work_order_counts` |
| Spares / stores | `get_low_stock_spares` · `get_critical_spares` · `get_stores_items` · `get_rob_analysis` · `get_spare_coverage_analysis` · `get_consumption_analysis` |
| Components / RH | `get_components` · `get_running_hours` · `get_running_hours_analytics` · `get_component_health_score` · `get_equipment_comparison` |
| Jobs / planning | `get_jobs` · `get_maintenance_calendar` · `get_maintenance_planner` · `get_workload_analysis` · `get_workload_forecast` · `get_maintenance_insights` · `get_performance_trends` |
| Defects | `get_defects` · `get_recurring_defect_analysis` |
| Certificates / compliance | `get_compliance_alerts` |
| Change requests | `get_change_request_analysis` |
| Fleet / navigation | `get_fleet_overview` (Office-only) · `generate_deep_link` · `get_cost_impact_estimate` |

Many "analysis" tools aggregate several reads and return **summaries, not row dumps** — this is
the shape the Data API should keep (small, LLM-friendly payloads).

### 3.7 What is NOT there today (why the central plan exists)

- No documentation retrieval — how-to answers are ungrounded (Stage B2 pending).
- No masking (Stage B3 pending), no admin console (Stage C), no caching/cost tiering (Stage D).
- Conversation history lives in the client; the server is stateless per request.
- The bot is compiled into the Technical module — nothing of it is reachable from Crewing/Audit.

## 4. Knowledge base — one store, all modules

- Current state (PROVEN 09-Sep): collection `technical_docs`, **231 chunks** — 3 June Technical
  manuals + 5 current operational gap docs. Technical only.
- All other modules' manuals already exist under `D:\manuals\SAIL - User Manuals\` —
  **Audit (4) · Safety (7) · Incident (4) · Crewing (1)** — plus a newer Technical manual
  (PMS Vessel-Specific R3, 08-Jul-2026) not yet indexed.
- Plan: index everything into the store with a **`module` metadata tag** per chunk (one
  collection, tagged — simplest for intent routing; per-module collections remain an option if
  retrieval quality demands it). Intent routing = classify the question's module → filter
  retrieval by tag; ambiguous questions search all tags and cite the module in the answer.
- The manuals are global (identical for every tenant) — no per-tenant doc routing (unchanged
  decision from the enterprise plan). Which modules a given tenant can ASK about is a different
  question, governed by the module×tenant matrix (§4.1).

### 4.1 Per-module, per-tenant enablement matrix (kill switch + entitlement in one check)

The whole-assistant `ai_enabled` flag stays, and beneath it sits a **matrix: module × tenant →
on/off**, consulted by the central service for BOTH answer paths:

- **Documentation answers:** intent routing only ever considers modules enabled for the asking
  tenant. A tenant without Crewing gets no Crewing answers — the router cannot even select the
  tag. (An explicit question about a disabled module gets a clean "not available for your
  organization" reply, not silence.)
- **Data answers:** the central service refuses to call a module's Data API for a tenant with
  that module off — the module's own scope check (R2) remains the second line, not the first.

**One check, two reasons:** "tenant is not using this module" and "admin switched it off" are
deliberately the same lookup — the matrix row. A misbehaving module can be disabled for one
client (or all) without touching the assistant elsewhere, and clients only ever get answers
for modules they actually use.

**How the service knows tenants — self-registration on first use (no platform dependency):**
the central service runs on its own server with **no client database**. It does NOT connect to
the PMS/SAILERP master DB (that would put client-boundary DB credentials on the AI server and
couple the "independent" service to that DB's schema and availability — and the Stage A
conversation log would drag the same dependency in a second time). It also does NOT consume any
registry feed from the platform — nothing has to be built or maintained on the SAILERP side.
Instead, **the service discovers its world from usage**:

- **Registration:** a module embeds the widget per the integration guide (§6 step 0). On the
  **first chatbot interaction** from a given client × module pair, the central service
  registers that pair in its own store: tenant/domain, tuid, module, first-seen timestamp
  (taken from the **signed identity + widget context** of that request — a pair can only come
  into existence through an authenticated interaction, never via an open endpoint).
- **The admin console reflects reality, not configuration:** it lists every registered
  client × module pair with an enable/disable switch. Nothing is pre-configured; what appears
  is what is actually in use. Entitlement takes care of itself by construction — the widget
  only exists inside modules a client actually runs, so a pair can only register for a module
  that tenant genuinely uses.
- **Intent routing scope follows registration:** the router considers only that tenant's
  registered-and-enabled modules (plus the module the current request originates from, which
  registers itself on this very interaction). A tenant's cross-module reach grows exactly as
  their real module usage does.

**DEFAULT ON at first registration — a deliberate choice:** a newly discovered client × module
pair is **ENABLED immediately**, and an admin can disable it afterwards. Fail-closed here would
mean every new pair starts broken with nobody watching the console — the assistant would fail
its first impression with every client, every module, by design. The switch therefore opens on
discovery and closes on decision (once a row exists and is off, it is off — the disable side
stays fail-closed).

**Risks of default-ON, flagged, with mitigations:**

1. **First use precedes admin awareness** (answers flow and tokens are spent before anyone has
   looked at the pair). Mitigation **(decided 10-Sep-2026)**: every new registration writes a
   **durable notification record shown in the admin console** (pairs list with first-seen /
   last-used + a notifications list) — email delivery was deliberately dropped as not critical
   enough to warrant a mail transport; the console list is the stated mitigation. The existing
   upstream caps bound the exposure meanwhile — per-user rate limit, per-message loop budget,
   per-pair kill switch.
2. **The module claim in the widget context is client-supplied.** The identity is signed
   (§5.3) but the module name rides the widget's context. A tampered module claim could
   register a pair the tenant's UI would never produce. Mitigation: plausibility checks
   (module must be one the service knows at all; new-pair notification makes an odd pair
   visible immediately), and the consequence is bounded — documentation answers only, since a
   Data API call still faces the module's own server-side scope check (R2) with the signed
   identity.
3. **Stale pairs** (a client stops using a module; the pair lingers enabled). Cosmetic — the
   console shows last-used alongside first-seen so stale pairs are visible; no automatic
   expiry (an admin decision, not a timer).

**The store:** the service owns its **own small Postgres** — the registration/settings matrix,
the conversation log (§5.8), and ratings all live here. When the bot moves out of the Technical
module, the Stage A log moves with it — this store is the "central Safe Lanes ops store" the
enterprise plan referred to, and it removes the log's current hidden master-DB dependency.
Single-tenant deployments can bypass discovery with an env list
(`ASSISTANT_MODULES=technical,crewing,...`). Managed from the Stage C admin console when it
lands; by SQL until then.

### 4.2 Intent-routing failure mode (designed, not deferred to measurement)

The dangerous failure is not ambiguity but **confident wrongness**: a Crewing question answered
from Technical manuals, dressed with a citation that makes it look authoritative. Defined
behaviour:

- **The router scores, it does not just pick.** Module classification returns a confidence.
  **Below the threshold** the assistant does not answer — it asks: *"Is this about Crewing or
  Technical?"* listing only the tenant's enabled modules (§4.1). One extra turn beats one wrong
  cited answer.
- **A second gate on retrieval:** even with a confident module choice, if the best retrieved
  chunks score below a minimum similarity, the answer is **"that isn't covered in the <module>
  documentation"** — never the nearest-wrong-section. (This is the existing Stage-B
  refuse-when-undocumented rule, applied per module.)
- **Every documentation answer names its source module and manual** in the citation line, so a
  misroute that slips through both gates is at least visible to the user as such.
- Thresholds start conservative (prefer asking over guessing) and are tuned from the central
  log, which records the routing decision + confidence per turn. §8 keeps the tuning question;
  the behaviour above is fixed design.

## 5. The Assistant Data API — live-data endpoint requirements

This is what a module implements so the central assistant can answer **live-data questions** for
it. It is optional per module and additive at any time.

### 5.1 What it is

A small, authenticated, **read-only** HTTP surface inside the module's existing backend, exposing
that module's "assistant tools" to the central service. Two endpoints:

1. **`GET /assistant/manifest`** — returns the module's tool catalogue: for each tool its
   `name`, natural-language `description` (this text is what the LLM uses to decide when to call
   it — write it like the Technical descriptions in §3.6), and JSON-schema `parameters`. The
   central service fetches manifests at startup/refresh and merges them into one registry —
   **adding a tool to a module requires no central-service change.**
2. **`POST /assistant/execute`** — body `{ tool: string, args: object, user: ForwardedIdentity,
   requestId: string }` → returns `{ ok: true, data: <JSON> }` or `{ ok: false, error: <plain-
   language string> }`.

### 5.2 The non-negotiable rules (each maps to a proven behaviour in §3)

| # | Rule | Why (from the Technical investigation) |
|---|---|---|
| R1 | **Read-only.** No tool may write, and the endpoints must be wired to service-layer READ paths only. | The whole Phase-1 bot is read-only by design; actions come only via Phase 2's propose→confirm→execute. |
| R2 | **The module enforces scope — never the caller.** Treat `args` as LLM-supplied and hostile; re-check the forwarded user's role/vessel/tenant against every read (§3.5 pattern). A module must NOT assume the central service pre-filtered anything. | `vesselId` comes from the LLM; Technical re-checks it inside `executeTool` before any DB read. |
| R3 | **Denials and failures are data, not HTTP errors.** Return `{ok:false, error:"You don't have access to vessel X"}` with HTTP 200 so the LLM can relay it politely. Reserve non-200 for transport/auth failures. | §3.5 — Technical returns error objects as tool output. |
| R4 | **Summaries over row dumps.** Cap list sizes; prefer counts/aggregates; strip internal ids the answer doesn't need. Target: a tool response comfortably under ~20 KB. | §3.6 — the analysis tools return summaries; token cost and masking both depend on small payloads. |
| R5 | **Fast and bounded.** Respond within **10 s** (the central service enforces this timeout; see §5.7 for how it composes with the loop budget). No unbounded scans — the Technical alert-engine lesson: SQL-prefilter, never load-everything-then-filter. | Perf incident history (Sep-2026 CPU spikes were exactly load-everything paths). |
| R6 | **Tenant-safe.** In MT deployments, resolve the tenant from the forwarded identity and enter tenant context exactly as the module's own routes do. Never cache cross-tenant. | §3.2; MT guardrail #15 in the enterprise plan. |
| R7 | **Stateless & idempotent.** Same request → same answer; no session state; `requestId` is for log correlation only. | Central service retries on timeout. |
| R8 | **Log locally like any API call** (normal module logs). The central service owns the conversation-level log; don't duplicate it. | §3.3 — one central `chatbot_interactions` store. |

### 5.3 Authentication — two layers, both required, **signed from day one**

1. **Service-to-service:** the central service authenticates to the module with a per-module
   secret/API key (rotatable, per environment). Requests without it → 401. This prevents
   anyone on the network calling the data API directly.
2. **Signed forwarded user identity — pilot included, not deferred.** Every `execute` call
   carries the end user's identity (`ForwardedIdentity = { userId, userName, role, vesselId?,
   tenantDomain?, tuid?, iat, exp }`) **signed by the central service** (HMAC over the identity
   payload with a per-module signing key, or an equivalent short-lived JWT; expiry ≤ 60 s).
   The module verifies the signature and expiry **before** honouring any field. An unsigned or
   expired identity is rejected even when the service secret is valid.

   **Why this is not optional for the pilot:** a bare shared secret would let whoever holds it
   assert ANY identity — Sail Admin role, any vessel, any tenant — and the module would honour
   it. That is a full authorization bypass, the exact class of finding (mock role, fail-open
   guards) just closed in PMS. The signing is a few lines on each side; there is no cheaper
   point to add it than day one. The reference implementation (§5.5) ships with verification
   included, and the acceptance checklist (§6) tests it. Verification carries a **bounded
   clock-skew leeway (90 s, both directions — expiry gets grace, a token future-dated beyond
   the leeway is rejected)**: mint and verify run on different machines, and the skew is not
   hypothetical — the AI server measured **62 s ahead** of the build workstation during the
   Stage 2 build, and clock mismatch has caused real incidents in this fleet before (sync
   LWW ordering). Never assume two of our hosts agree on the time.

This mirrors how the module trusts SAILERP-forwarded headers today — same trust shape, one more
trusted forwarder — but with the assertion made tamper-evident.

### 5.4 Versioning

- Manifest carries `apiVersion` (start `1`). Additive changes (new tools, new optional params)
  need no version bump. Breaking changes bump it; the central service refuses a version it does
  not know rather than guessing.

### 5.5 How Technical maps onto this (reference implementation)

Technical is 90% done — the 30 tools, their schemas/descriptions, and the scope enforcement all
exist in `chatbotService.ts`. The work is packaging, not building:

1. Move `CHATBOT_TOOLS` (the definitions) and `executeTool` (the dispatch + scope checks) behind
   `GET /assistant/manifest` + `POST /assistant/execute` routes.
2. Replace the in-process `access` object with the `ForwardedIdentity` from the request body
   (validated by the service secret) — `canAccessVessel` and the fleet-overview refusal stay
   byte-identical.
3. Delete nothing: the embedded `/chat` endpoint keeps working during transition (§7).

### 5.6 What the central service guarantees to modules

- It calls execute only with tools/args from that module's own manifest.
- It forwards the user identity signed and unmodified from the authenticated session (§5.3).
- It never calls a module for a tenant whose matrix row (§4.1) is off.
- It masks module data before it reaches the external LLM (Stage B3) and never persists module
  data beyond the conversation log (retention position in §5.8).
- It rate-limits and budget-caps upstream, so a module will not be hammered by a runaway loop
  (per-message bounds in §5.7).

### 5.7 Time-budget reconciliation (R5 × the LLM loop bounds)

The inherited §3.4 numbers (8 tool iterations, 60 s per LLM call, 120 s wall-clock) and R5's
10 s per tool do not multiply out — a worst case of eight sequential 10 s tool calls plus LLM
round-trips blows the 120 s ceiling, meaning the user waits two minutes and then gets a generic
failure. Resolved as follows (graceful degradation chosen over tighter caps, because typical
answers use 1–3 tools and should not pay for the worst case):

- **Per tool call: 10 s, enforced by the central service** (kept from R5). A tool timeout is fed
  back to the LLM as `{ok:false, error:"<module>/<tool> timed out"}` — data, not an abort — so
  the loop can answer from what it has or try a different tool.
- **Iteration cap 8 kept**, but with a **soft deadline at 90 s**: once elapsed time crosses it,
  no further tool calls are made; the loop goes straight to final synthesis over whatever was
  gathered, and the answer says so plainly ("based on partial data — <module>/<tool> did not
  respond in time"). A **partial, honest answer replaces the generic failure.**
- **Hard ceiling 120 s** (unchanged) now backstops only true stalls (an LLM call hanging), where
  the graceful "having trouble connecting" fallback remains correct.
- Per-LLM-call timeout drops from 60 s to **30 s** — with gpt-4o-class models a call that has
  produced nothing in 30 s is not going to; this buys the soft-deadline room inside the ceiling.

### 5.8 Conversation-log retention & redaction (client-audit position)

The central log stores full questions and answers, which will contain vessel names, defect
descriptions and crew details — a client audit will ask about it. Position, so there is one:

- **Access:** Safe Lanes internal admin console only (unchanged); the log lives in the central
  ops store keyed by tenant, never in tenant DBs.
- **Retention:** rolling **6-month** purge by default, configurable per tenant; a tenant's rows
  are deleted on contract end or on written request (the tenant key makes this a single delete).
- **Redaction:** once Stage B3 masking exists, the log optionally stores the **masked** variant
  of what was sent to the LLM alongside the real text; tenants with stricter requirements can be
  set to masked-only logging (trades admin debuggability for privacy, per tenant).
- Ratings/quality metadata survive purges in anonymised aggregate (counts and scores, no text).

## 6. How another module team develops their Assistant Data API

Effort for a first useful version: **S–M (2–5 days)** — most of it deciding the tools, not
coding. **That estimate holds only for a module that already has clean service-layer reads WITH
its own scope enforcement** (Technical does — §3.5 exists and is tested). A module where "which
records may this role see" is enforced only in the UI, or not at all, will spend the time
building that enforcement first, not writing tool definitions — the Defects×approval-engine
integration is the precedent: the module had no approval surface, so what looked like wiring was
a build (~2/3 of that effort was the module-side gate, not the integration). Each module team
should answer "where is our server-side scope check?" before quoting a date; if the answer is
"nowhere", size it as M–L.

**Step 0 — Embed the widget (this alone gives your module a working assistant).** Mount the
shared chat widget in the module UI — either the module inherits it from the SAILERP shell
mount (preferred: zero module code), or the module mounts the widget bundle itself where the
shell mount is not available. The mount supplies the widget's **context**: `{ module:
"<module-id>", currentPage, vesselId?, vesselName? }` — the module id is what the central
service registers on first use (§4.1), and currentPage/vessel make answers context-aware.
The user's identity is NOT the module's job — the widget rides the existing authenticated
session and the central service signs what it forwards. **After step 0, documentation answers
for your module work with no further module development** — the first interaction registers
your module for that client (enabled by default), and indexing your manuals (§4) is a central
task, not a module one. Steps 1–5 below are only for modules that also want live-data answers.

**Step 1 — Pick 5–10 questions users actually ask.** ("Which crew certificates expire this
month?", "Open audit findings for vessel X?") Don't start from tables; start from questions.

**Step 2 — Define the tools.** One tool per question family: name, an LLM-facing description
(1–3 sentences, say WHEN to use it — copy the style of §3.6), JSON-schema parameters. Fewer,
richer tools beat many granular ones.

**Step 3 — Implement the two endpoints** inside the module backend, calling **existing service-
layer read functions** (never raw SQL, never skipping the module's own auth/scope layer).

**Step 4 — Enforce scope per rule R2** using the forwarded identity and the module's existing
access rules (whatever "which vessels/records may this role see" already means in that module).

**Step 5 — Shape the outputs per R4** (small, aggregate, plain field names).

**Acceptance checklist (the central team tests this before wiring in):**

- [ ] Manifest returns valid JSON-schema for every tool; descriptions state when to use the tool
- [ ] Every tool read-only (code-reviewed: no writes reachable)
- [ ] Request without service secret → 401; **unsigned, tampered, or expired identity → rejected
      even with a valid service secret** (§5.3)
- [ ] With valid secret + signature but foreign `vesselId`/record for a restricted role →
      `{ok:false, error:...}` (HTTP 200)
- [ ] A Ship-role identity cannot read fleet-wide or other-vessel data on ANY tool
- [ ] Responses < 20 KB on realistic data; every tool answers < 10 s
- [ ] MT (where applicable): two-tenant test proves no cross-tenant leakage
- [ ] Idempotent: repeated call returns the same result

**What a module does NOT build:** any LLM code, prompt logic, retrieval, masking, rate limiting,
logging UI, or chat UI. All central.

## 7. Build order

1. **Index all modules' manuals + Technical R3** into the tagged store (fuel for everything;
   cheap — the indexer is proven, parsing is cached for existing docs).
2. **Stand up the central service** (Docker, AI server, own OpenAI key per the per-app key
   policy): port Stage A machinery from the Technical branch, add RAG retrieval with citations +
   module intent routing (= Stage B2, built in its new home, for ALL modules at once).
3. **Shared widget** embedded via the SAILERP shell; Technical first as pilot.
4. **Technical Data API** — repackage the 30 tools per §5.5; the central bot now equals today's
   Technical bot PLUS grounded how-to for every module.
5. **Retire the embedded Technical `/chat`** once the central path is proven (until then both
   run; the widget flips endpoint by flag).
6. **Other modules' Data APIs** — per §6, each on its own schedule; how-to answers work for them
   from step 3 regardless.
7. **Masking (B3), admin console (C), cost tiering (D)** — as per the enterprise plan, now
   central. **Phase-2 walkthroughs** ride the widget when Phase 1 is trusted.

## 8. Prerequisites and open decisions

**Go-live prerequisites (blocking before any client-facing deployment):**

- ~~**OpenAI DPA (Sahil)**~~ — **COMPLETE (Sahil, recorded 10-Sep-2026).** No longer a gate;
  the Bedrock track remains available as a data-residency option, not a DPA workaround.
- **Dedicated OpenAI key — FINAL (Ghazi, 10-Sep-2026, supersedes the earlier none-needed call):**
  a per-app key IS created for the assistant (project `sail-assistant`, the post-incident
  pattern: own project, model allow-list, spend cap). Allow-list = `text-embedding-3-large`
  + `gpt-4o-mini` only — no larger model; grounded answers suit the small model (same as
  SMS RAG). The temporarily borrowed production-RAG key retires when the key is swapped in.
- **Production home** for the central service (AI server is pilot-grade; production sits in our
  boundary or uses Bedrock) + secret management for the per-module service and signing keys.
- **New-pair admin notification** (§4.1) wired before multi-tenant go-live — default-ON
  self-registration is only acceptable with the notification that makes each new
  client × module pair immediately visible.

**Open decisions (build can start while these settle):**

- Jeevan's wording verification of the operational gap docs (carried over, still open).
- Intent-routing threshold tuning + one tagged collection vs per-module collections — behaviour
  is fixed in §4.2; the thresholds and collection layout are tuned on evidence after the first
  cross-module index.
- Per-tenant retention overrides and masked-only logging defaults (§5.8) as client contracts
  require.

## 9. Out of scope (unchanged from the enterprise plan)

Engineering internals in answers · multi-tenancy plumbing docs · client-facing admin ·
per-tenant doc sets · any write/action before Phase 2's guarded pattern.

---

*Planning document only — no code changes. §3 is a faithful inventory of the code at
`feature/chatbot-enterprise` 7a958fc53; §5–§6 derive every requirement from behaviour that
already exists and is tested there.*
