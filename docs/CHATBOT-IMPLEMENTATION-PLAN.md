# SAIL AI Assistant — Implementation Plan (Build Plan)

**Status:** Planning only — no code, no branch, no build. Companion to
`CHATBOT-CENTRAL-SERVICE-PLAN.md` (architecture, rev 2) and `CHATBOT-ENTERPRISE-PLAN.md`
(Phase-1 stages A–D). Those documents settle WHAT and WHY; this one settles the BUILD ORDER,
what moves vs what is new, the transition, and who is needed when.
**Written:** 10-Sep-2026, from `replit_dev` @ `b2e2e6b20` and `feature/chatbot-enterprise`
@ `7a958fc53`.
**Servers:** every stage runs on infrastructure that already exists — the **AI testing
server** (the box hosting the ChromaDB knowledge store used for the 09-Sep rebuild) for
pilot/build, and the **production RAG server (13.250.9.130)** only as the production
reference point. Production hosting for the central service remains the open decision in the
architecture plan's §8 — this document does not resolve it, it only states where each stage
runs during the build.

---

## ONE-PAGE SUMMARY (for Sahil / Vimal)

**What we are building.** One AI assistant for all SAIL modules. Today's chatbot lives only
inside the Technical module and has a known weakness: it answers "how do I…" questions from
general AI knowledge, so it can sound confident and be wrong. We are moving the assistant out
into its own central service and grounding it in our real user manuals — for **every**
module, not just Technical. Each module then simply shows the same chat window.

**The order, and what you will see at each step:**

1. **Manual-based answers for all five modules** *(first, because it needs nothing from any
   module team)*. Demo: ask it "how do I create a work order?", "how do I raise a near
   miss?", "how do I plan crew change?" — it answers from the actual PMS, Incident and
   Crewing manuals, **quotes the manual section it used**, and says "that isn't in the
   documentation" instead of guessing.
2. **The safety shell around it.** Demo: switch the assistant off for one client and one
   module with a single switch; show every conversation recorded in one log; show a forged
   request being rejected.
3. **Live-data answers for Technical** ("what's overdue on this vessel?") through the
   central service. Demo: data questions answered with the module's real data, and a
   ship user provably unable to see another vessel's data.
4. **The chat window inside the application**, switchable between old and new by a flag, so
   we can revert instantly if anything misbehaves.
5. **Privacy masking** — vessel and people names are replaced with placeholders before
   anything leaves for the AI provider, and restored in the answer.
6. **An internal admin console** — Safe Lanes staff can read conversations, rate answer
   quality, update the manuals in the knowledge base, and see AI spend per client.
7. **A second module gets live-data answers** — proving any module can plug in.

**What we need from you:** sign-off that the June/July manuals are the right versions
to index (and newer revisions if they exist); and at step 7, a decision on which module
goes second plus a few days of that module team's time. The OpenAI data-processing agreement is **already completed**, and the AI key question is settled (a dedicated key for the assistant, restricted to the two small models it needs — same per-app pattern as our other AI systems). Everything runs on the existing AI test
server until we jointly decide the production home.

---

## 1. Stages in dependency order

Size scale (same as the enterprise plan): **S** ≤ ~2 days · **M** ~3–5 days · **L** ~1–2
weeks. Every stage is independently demoable; no stage silently depends on a later one.

### Stage 1 — Cross-module knowledge base + grounded answer service
**Server:** AI testing server (new Docker container beside `technical-chromadb`; bound
internal-only like the store itself — no public exposure at this stage).
**Builds:**
- Index ALL modules' manuals into the tagged collection: Audit (4), Safety (7), Incident
  (4), Crewing (1), plus the newer Technical *PMS Vessel-Specific R3 (08-Jul-2026)* — on top
  of the 231 Technical chunks already live. One `module` tag per chunk (architecture §4).
- A minimal central service: one `/chat` endpoint doing **documentation answers only** —
  intent routing with the §4.2 gates (confidence threshold → "which module did you mean?";
  retrieval-similarity floor → "not documented"), answers with citations naming module +
  manual + section. No data tools, no widget, no external exposure.
**Depends on:** the manuals (already on disk at `D:\manuals\SAIL - User Manuals\`), the AI
server (exists), the settled key (§4 row 1), the proven indexer recipe (exists —
09-Sep rebuild).
**Demo for Sahil:** a plain test page (or Postman) on the pilot: five how-to questions, one
per module, each answered with the right manual cited; one ambiguous question that triggers
"did you mean Crewing or Technical?"; one out-of-scope question that gets an honest "not
documented".
**Proof:** a scripted retrieval suite — per-module queries must hit the correct manual's
correct section as the top result (the 09-Sep Technical smoke suite, extended to all
modules); routing-gate tests (ambiguous → clarify, low similarity → refuse); the index
integrity report clean for all ~20 documents.
**Size: M.** Honest basis: the indexing itself is S (the recipe is proven, parsing is
cached for existing docs), and the service skeleton is bounded — but **routing quality
across five modules with overlapping vocabulary ("certificate" exists in Technical, Crewing
AND Audit) is the unknown**. The M includes a tuning loop against the smoke suite; if the
first-pass confusion rate is high, this stage grows and §6-risk-2 fires early, visibly.

### Stage 2 — Central service core: own store, Stage-A machinery, signed identity
**Server:** AI testing server (same container + its own small Postgres).
**Builds:** the service's own Postgres (registration/settings matrix, conversation log,
ratings — architecture §4.1); the ported Stage-A machinery (see §2 below for the
item-by-item move list); **identity signing on day one** (§5.3) — the service signs what it
forwards and rejects unsigned/tampered/expired identities on its own inbound admin/test
surface; client×module self-registration on first interaction, default-ON, with a
durable new-pair notification record surfaced in the admin console (email deliberately
dropped — 10-Sep decision; the console list is the mitigation).
**Depends on:** Stage 1 (the service exists); nothing from any module team.
**Demo for Sahil:** first interaction from a test "client" auto-appears as a registered
pair; flip its switch off → clean "not enabled" answer; conversation log showing question,
answer, module, tokens, latency; a tampered identity rejected.
**Proof:** the §6 acceptance checks that apply centrally — tampered/expired identity
rejected, rate limit fires (the 31-request test, already proven once on the pilot),
kill-switch off = zero LLM calls, log row per turn, matrix fail-closed when a row is off.
**Size: M.** Honest basis: most pieces port from the Technical module with known shapes
(§2); the fresh work is the store schema, signing, and registration — all small, but
security-reviewed work shouldn't be rushed into an S.

### Stage 3 — Technical Data API + central tool loop (correctness-proven)
**Server:** central service on the AI testing server; the Data API rides the **Technical
module backend** (built on `feature/chatbot-enterprise`, demoed against the local pilot
shore — no production deploy in this stage).
**Builds:** in the Technical repo — `GET /assistant/manifest` + `POST /assistant/execute`
wrapping the existing 30 tool definitions and `executeTool` dispatch (architecture §5.5:
repackaging, not rebuilding), fed by the signed `ForwardedIdentity`; in the central service —
the manifest-driven tool registry and the ported LLM loop with the §5.7 budget rules
(10 s/tool enforced centrally, 30 s per LLM call, 90 s soft deadline → honest partial
answer); a **correctness harness**: a scripted question + scope suite run against the Data API and
the central path — permissions enforced (ship user cannot see fleet or other vessels),
right data returned, citations honest, forged/expired identities rejected. *(Reframed
10-Sep: the old embedded bot is not a comparison reference — built by the non-technical
team, never tested, never grounded; correctness is tested directly.)*
**Depends on:** Stage 2 (signing + registry); pilot shore (exists).
**Demo for Sahil:** "what's overdue on this vessel?" answered from the module's real
data; a ship-role identity asking about the fleet or another vessel refused cleanly.
**Proof:** correctness harness green on the scripted set (every scope denial enforced,
zero cross-vessel leaks); the §6 acceptance checklist run against Technical's Data API —
including tampered-identity rejection and the Ship-role fleet-data refusal; tsc baseline
unchanged (294) on the Technical branch.
**Size: M.** Honest basis: §5.5 already established this is packaging (~90% of the logic
exists and is tested); the correctness harness is the real new artifact, and it's exactly
the kind of harness we've built repeatedly (p01–p04 pattern).

### Stage 4 — Shared widget + in-app pilot behind a flag
**Server:** central service on the AI testing server; widget ships with the Technical
client build (dev environment first).
**Builds:** extract the existing chat UI (`client/src/components/chat/*` + `useChat.ts`,
~500 lines — inspected: entanglement is shallow, just `useVessel`/`useAuth` context reads
and a hardcoded endpoint URL) into a shared widget package taking `{module, currentPage,
vesselId, endpoint}` as mount props; the endpoint **flag** (§3 below); the **identity
token mint**: a tiny module-backend endpoint (e.g. `GET /assistant/token`) that converts
the module's already-resolved session identity into the short-lived signed assertion the
widget attaches to central calls. Mount in Technical first — the SAILERP shell mount is
the preferred end state but only needs a release slot from the shell team; Technical-mount
ships without waiting for it.
**Identity is a known path, not an unknown.** This is the multi-tenancy implementation we
built: login happens in SAILERP, the tenant domain is resolved there, and the user profile
(including myVessels) is held **encrypted in browser localStorage**; `AuthContext` decrypts
it and the `x-user-id` identity rides every module request, with the module backend
resolving tenant context from it (verified again in `AuthContext.tsx` / `useChat.ts` while
writing this). The widget therefore never holds signing keys and SAILERP needs no change:
**the module backend — which already holds the verified identity — mints the signed
token.** One design guard, from the known backlog: the mint endpoint must refuse to mint
from the mock-identity fallback (`auth.ts` MOCK 'Sail Admin') — minting only from a real
resolved identity, otherwise the signed token would launder the mock. That guard is part of
this stage's proof.
**Depends on:** Stage 3 (otherwise flipping the flag loses data answers — a visible
regression); Stage 2's verifier.
**Demo for Sahil:** inside the Technical dev UI — one chat window answering BOTH a
Crewing how-to (cited from the Crewing manual) and a Technical data question; then the flag
flipped back live, showing instant return to the old bot.
**Proof:** browser-proven on the pilot (the standing standard for UI claims); the
per-request fallback exercised (central down → widget silently uses the old path); the
mock-identity mint refusal tested; the transition criteria (§3) start their measurement
clock here.
**Size: S–M.** Honest basis: widget extraction S (inspected, shallow), flag + fallback S,
token mint + attach S — several small pieces plus the browser-proven pilot and the start of
the measurement window. Nothing here needs SAILERP-repo work; the only SAILERP item left on
this stage is the optional shell-mount slot, which is scheduling, not engineering.

### Stage 5 — Masking + old-path retirement
**Server:** central service on the AI testing server.
**Builds:** mask-out/un-mask-in (enterprise plan B3): vessel/person names → placeholders
before the LLM, restored after, map surviving the whole tool loop; the optional masked-only
logging mode (§5.8); then — only once the §3 criteria are met — removal of the embedded
`/chat` path from the Technical module in a normal Technical release.
**Depends on:** Stage 4 running in front of pilot users (masking needs real traffic shapes;
retirement needs the criteria clock).
**Demo for Sahil:** the conversation log showing what the LLM actually received —
"Vessel-1", "Person-A" — beside what the user saw: real names.
**Proof:** masking unit suite (names/IDs never appear in outbound LLM payloads across the
scripted set, including tool outputs); retirement gated by §3's measured criteria, not by
calendar.
**Size: M** (matches the enterprise plan's B3 = M; the retirement itself is S).

### Stage 6 — Internal admin console
**Server:** AI testing server (internal-only access, like everything else there).
**Builds:** enterprise-plan Stage C in the central home: conversation viewer with ratings
(C1), the doc manager (upload → auto-index → integrity report — C2, reusing the proven
indexer + manifest/audit pattern), per-client cost rollup (C3), and the §4.1 pair list with
enable/disable and first-seen/last-used.
**Depends on:** Stages 1–2 (log + store + index to manage). Independent of Stages 3–5 —
can be built in parallel after Stage 2 if hands are available.
**Demo for Sahil:** open the console, read a real conversation with the docs it cited, rate
it, upload a revised manual and watch it re-index, see spend per client.
**Proof:** the C2 no-orphan/no-duplicate-chunk audit after a replace; cost rollup totals
reconcile with the raw log.
**Size: M–L** (enterprise plan sized C1/C2/C3 at M + M–L + M; consolidated here because the
log and store now have one home).

### Stage 7 — Second module's Data API
**Server:** that module's own backend + the central service.
**Builds:** the second module's manifest/execute endpoints per the §6 guide — by that
module's team, with us reviewing against the acceptance checklist.
**Depends on:** Stage 3 proven (Technical is the reference implementation); a **module
choice decision** (§5 below); that team's time.
**Demo for Sahil:** a live-data question in the second module's domain answered in-app.
**Proof:** the §6 acceptance checklist, run by us against their endpoints.
**Size: S–M for the module team IF it has server-side scope enforcement; M–L if not** — see
§5. Cannot be sized further from this repo.

---

## 2. What MOVES vs what is NEW

The Stage-A machinery exists inside the Technical module (branch
`feature/chatbot-enterprise`, pilot-proven). Item by item:

| Item | Disposition | Notes |
|---|---|---|
| Rate limiter (`rateLimiter.ts`, per-user sliding window) | **Ported as-is** | In-memory is fine — the central service is single-instance like PM2 fork mode. |
| Per-tenant on/off (`tenants.ai_enabled` lookup) | **Ported with changes** | The check stays; the source changes from the PMS master DB to the service's own matrix (§4.1). Env fallback (`CHATBOT_ENABLED`) kept for single-tenant. |
| Conversation log (`chatbot_interactions`, fire-and-forget after reply) | **Ported with changes** | Same schema + new columns (module, routing confidence, docs cited); destination moves from the master DB to the service's own Postgres — the architecture plan's finding that the log must move. |
| LLM loop (`processChatMessage`) | **Ported with changes** | Structure and graceful fallback survive; timeouts change per §5.7 (60→30 s per call, new 90 s soft deadline → partial answer); the hardcoded `CHATBOT_TOOLS` array is replaced by the manifest-driven registry. |
| The 30 tool definitions (schemas + descriptions) | **Ported as-is** | They stay in the Technical repo, now served by `GET /assistant/manifest` instead of compiled into the bot. |
| `executeTool` dispatch + vessel-scope enforcement (`canAccessVessel`, Ship fleet-refusal) | **Ported as-is, re-fed** | Logic byte-identical; the `access` object now comes from the verified `ForwardedIdentity` instead of the in-process request. |
| Chat UI (`components/chat/*`, `useChat.ts`, ~500 lines) | **Ported with changes** | Extracted to a shared widget; context reads (`useVessel`/`useAuth`) become mount props; endpoint becomes the flag. |
| Central service skeleton (Express app, Docker, own Postgres) | **NEW** | Small; mirrors patterns we run already. |
| Identity signing (mint + verify, both sides) | **NEW** | Day-one requirement (§5.3). |
| Self-registration + matrix + new-pair notification | **NEW** | §4.1. |
| Intent router + retrieval tool + citations (`search_module_docs`) | **NEW** | Stage B2, built in the central home. |
| Correctness harness | **NEW** | Stage 3's proof artifact (scope + data + citations tested directly). |
| Masking (B3) | **NEW** | Stage 5. |
| Admin console (C1–C3) | **NEW** | Stage 6, atop the ported log + proven indexer. |

Net: **a relocation with two genuinely new subsystems** (routing/retrieval and
signing/registration) plus the console. It is not a rewrite — and any stage where porting
turns into rewriting is a signal to stop and re-check.

## 3. The transition (old embedded /chat ↔ central)

**The flag.** A widget mount prop/config value `chatEndpoint`: unset → the embedded
`/technical/api/chat` (today's behaviour, zero change); set → the central service URL. Set
per environment (dev first), with a per-session override for testers so old and new can be
compared side by side in the same build. During transition the widget also **falls back
per-request**: if the central call fails (5xx/timeout), it retries the old endpoint silently
— so a central outage during the pilot degrades to today's bot, not to a broken chat.

**"Proven" — the concrete retirement criteria, all measured, none calendar-only:**
1. Correctness harness green: 100% of the scripted data-question and scope suite passes —
   **every scope-denial case enforced** (a single cross-vessel leak resets the clock).
   *(Reframed 10-Sep on product-owner input: the old embedded bot was built by the
   non-technical team, never tested and never grounded in a knowledge base — "match the
   old bot" was the wrong yardstick; the yardstick is correctness, tested directly.)*
2. Two weeks of pilot usage with zero severity-1 incidents (wrong data, scope leak, or a
   silent failure the log missed).
3. Latency: central full-answer **p95 ≤ 15 s** (absolute target — the old path is not a
   reference). Basis: Stage 3 measured p95 6.3 s on the pilot (small sample, and through
   SSH tunnels that add latency); 15 s gives ~2× headroom for production networks and
   multi-tool questions while staying far under the 90 s soft deadline — a p95 beyond it
   signals stalling tools or model trouble, not normal variance.
4. The conversation log captured 100% of pilot turns (no gaps vs widget-side counts).
5. One rollback drill actually performed: flag flipped back in dev, verified, flipped
   forward again.

**Rollback.** Three independent levers, smallest first: (a) per-request automatic fallback
(above — no human needed); (b) flip the flag back — instant, client-config only, the old
path stays deployed and warm until retirement; (c) the central kill switch per
client×module (§4.1) for a misbehaving slice while the rest keeps running. Only after
retirement (old path removed from a Technical release) does rollback require a redeploy —
which is exactly why retirement waits for the criteria.

## 4. What each stage needs from PEOPLE

| Stage | Needs — named, so nothing stalls silently |
|---|---|
| 1 | **Dedicated OpenAI key — FINAL DECISION (Ghazi, 10-Sep, superseding the earlier keep-the-shared-key call): a dedicated per-app key IS being created** (project `sail-assistant`, same pattern as sms-rag/graph/viq), allow-list = `text-embedding-3-large` + `gpt-4o-mini` ONLY — no gpt-4o (the assistant never needs it; grounded answers suit the small model, same as SMS RAG). The borrowed production-RAG key retires on swap-in. **Manual sign-off** (Sahil/Jeevan): confirm the manual revisions on disk are current for Audit/Safety/Incident/Crewing, supply newer ones if they exist. Jeevan's gap-doc wording check (carried over — the drafts are indexed, review still due). AI-server access: already held. |
| 2 | Nobody external. Ghazi decides the admin-notification recipient address. |
| 3 | Nobody external (Technical repo + pilot are ours). Product sanity check (Jeevan, ~1 h): the parity question set covers the questions users actually ask. |
| 4 | QA: pilot users for the measurement window. SAILERP/shell team: a release slot for the (optional, later) shell mount — scheduling only; the Technical mount ships without it. |
| 5 | Ghazi: retention defaults sign-off (§5.8). *(OpenAI DPA: **COMPLETE** — Sahil, recorded 10-Sep-2026; no longer a gate.)* |
| 6 | Ghazi: who besides him gets console access. |
| 7 | **Decision (Sahil/Jeevan): which module goes second** (§5); that module team's availability; each candidate team answers "where is our server-side scope check?" before dates are quoted. |

## 5. The first module beyond Technical

**What I can assess from this repo: Technical only.** Crewing, Audit, Safety and Incident
live in their own repositories — I cannot see their service layers, and per the approval-
engine lesson the sizing question is precisely about what their code contains: **a module
with existing service-layer reads AND server-side scope enforcement is days; one enforcing
access only in the UI is a build** (Defects precedent: what looked like wiring was ~2/3
building the module-side gate).

**Recommendation:** don't pick on gut feel — run a **half-day scoping pass per candidate**
(their team answers the §6 guide's step-0 questions: where are the service-layer reads?
where is scope enforced server-side? what 5–10 questions would users ask?). Then choose on
three criteria: (a) scope enforcement exists server-side, (b) users demonstrably ask
data questions in that domain, (c) smallest useful tool set.

**Provisional lean, clearly labelled INFERRED, decided only after the scoping pass:**
**Crewing** — single manual (simplest knowledge domain), an obvious high-value question set
(crew lists, certificate expiries, planning), and an engaged team. But if its scoping pass
shows UI-only access control, it drops behind whichever module passes criterion (a) — that
criterion dominates, because it is the difference between S–M and M–L.

## 6. Risks that could stop the BUILD (with early signals)

These are implementation risks — distinct from the design risks already addressed in the
architecture plan.

1. **Cross-module routing quality is poor on real manuals.** Overlapping vocabulary
   (certificates, surveys, vessels appear in three modules) may confuse intent routing
   beyond what threshold tuning fixes, forcing per-module collections or better doc
   metadata. *Early signal:* Stage 1's smoke-suite confusion rate on the first index —
   measured on day one of tuning, not discovered at the demo.
2. **Other modules' PDFs parse badly.** The Technical manuals parsed cleanly, but
   scanned/image-heavy pages elsewhere would yield stub chunks. *Early signal:* the index
   integrity report — abnormal chunk counts or title-stubs on the first indexing run.
3. **AI-server co-tenancy.** The box already runs several RAGs; ports 8012/8015 are the
   known free slots, and the cost-overrun history lives on this infrastructure. *Early
   signal:* container resource contention or port conflicts at Stage 1 deploy; mitigated by
   resource limits on our containers and the dedicated key (spend isolation).
4. **The token mint launders the mock identity.** The known `auth.ts` mock-'Sail Admin'
   fallback (open hardening backlog) must never be a source the mint endpoint signs — a
   signed token minted from the mock would carry over-permission into the central path with
   a valid signature on it. *Early signal:* Stage 4's mint-refusal test (part of its proof);
   any environment where the mint succeeds without a real resolved identity fails the stage.
5. **Team bandwidth collision.** This build competes with #462 follow-up, the pending prod
   deploy, and QA's phase-2 rounds — same people. *Early signal:* a stage sitting >1 week
   without motion; the stage table makes that visible instead of silent.

## 7. Out of scope for this build plan

Phase-2 walkthroughs (seam preserved, nothing built) · the Bedrock provider track (an
independent M whenever chosen) · production hosting decision (§8 of the architecture plan —
each stage above runs on the existing AI test server until that decision is made) · #462
and all other Technical-module workstreams.

---

*Planning document only. Sizes are honest estimates against the stated basis; the one
place a size cannot be responsibly given without more information is named as a scoping
pass (Stage 7, per candidate module — their repos are not visible from here).*
