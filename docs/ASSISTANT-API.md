# SAIL AI Assistant — API Contract & Embedding Guide

**Base URL:** `https://assistant.sl-sail.com` — the permanent home, live and publicly
verified over real DNS (11-Sep-2026): Let's Encrypt TLS (auto-renew verified), health,
admin surface blocked (403), unsigned chat refused (401). The interim
`https://viqmap.sl-sail.com/assistant` still answers during the transition and will be
removed once no client build references it. (An earlier revision published
`graphai.sl-sail.com`, which has no public DNS record — retracted and corrected.)
**Service:** Python/FastAPI on Pydantic AI with the knowledge store in pgvector
(`docs/CHATBOT-PYTHON-PORT-PLAN.md` §S) — same contract as the Node original it replaced
on 11-Sep-2026; nothing below changed shape.
**Status:** service functional (documentation answers for all five modules); live-data
answers activate per module once that module deploys its Data API and the service is
configured to reach it (§4).

This is the complete surface. Anything not listed here does not exist.

---

## 1. The central service (what a widget / embedder calls)

### POST /chat
The one conversational endpoint.

Headers: `Content-Type: application/json` · `x-assistant-identity: <signed token>` (§3)
Body:
```json
{
  "message": "how do I report a near miss?",
  "conversationHistory": [ { "role": "user|assistant", "content": "..." } ],
  "context": { "module": "technical", "vesselId": "…", "vesselName": "…", "currentPage": "/pms" },
  "conversationId": "optional-thread-id"
}
```
Response (HTTP 200 for every conversational outcome — errors are honest messages,
not status codes, so a chat UI never breaks):
```json
{
  "response": "…answer text…",
  "gate": "answer | clarify | not_documented | disabled | rate_limited | masking_error | error",
  "module": "Incident",
  "citations": [ { "module": "Incident", "manual": "…", "section": "…" } ],
  "toolsUsed": ["get_fleet_overview"],
  "candidates": ["Technical","Crewing"],
  "partial": false,
  "usage": { "prompt_tokens": 0, "completion_tokens": 0 }
}
```
HTTP 401 only for identity failures: `{"error":"identity rejected: missing|malformed|bad-signature|expired|future-dated"}`.
Test/diagnostic mode: add `"routeOnly": true` → routing decision + citations, no LLM answer.

### POST /rate
End-user feedback. Same identity header. Body `{ "conversationId": "…", "rating": 1 | -1, "note": "optional" }` → `{ "ok": true }`.

### GET /health
`{ ok, store: "pgvector", indexSet, chunks, db, llmCalls, prompt, chatModel, temperature }` — llmCalls is a process counter used by test
suites to prove zero-cost gates.

### /admin/* (NOT public — nginx denies; SSH tunnel only)
`GET /admin/pairs` · `POST /admin/pairs/toggle {tenantDomain,module,enabled}` ·
`GET /admin/notifications` · `GET /admin/conversations/count` — all require the
`x-admin-token` header.

**Behaviour contract:** first interaction from a new client×module pair self-registers
it (enabled by default) and records an admin notification; a pair switched off gets a
clean "not enabled" reply with zero AI cost (fail-closed until re-enabled); per-user
rate limit 30/min; per-tool budget 10 s, per-LLM-call 30 s, 90 s soft deadline → the
answer says plainly it is partial.

## 1a. Privacy — masking & the conversation log (Stage 5)

**Nothing identifying reaches OpenAI.** Before any string leaves for the LLM or the
embedding API, the service replaces real vessel names, person names, IMO numbers and DB
UUIDs with per-request tokens (`[VESSEL_1]`, `[PERSON_1]`, `[IMO_1]`, `[ID_1]`). The model
reasons over tokens only; the final answer is un-masked so the **user sees real names and
OpenAI never did**. Both paths are covered — documentation retrieval (embedding input) and
data-tool results (masked before they rejoin the prompt; LLM-produced tool arguments are
un-masked before the module runs, so modules always work on real values).

- Masking is whole-identifier and boundary-aware: a vessel named "Gas Mia" masks only the
  full name, never the word "gas"; text that merely looks like a name is left alone.
- **Failure policy:** if masking fails, the REQUEST IS REFUSED before any LLM call — a raw
  name never leaks. If an answer contains a token that cannot be mapped back, the
  placeholder stays **visible** (and is logged) rather than guessed — visible beats leak.
- **Config:** on by default (`ASSISTANT_MASKING=off` to disable);
  `ASSISTANT_MASKING_DISABLED_TENANTS` opts a tenant out.

**Conversation log — what it stores:** the log lives in the assistant's own Postgres
(admin-console only, never a tenant DB). By default it stores the **real** question/answer
text for admin debuggability. A tenant listed in `ASSISTANT_MASKED_ONLY_LOG_TENANTS` has
its log stored **tokenised** instead (privacy over debuggability) — this is the per-tenant
audit switch. Retention: rolling 6-month purge, per-tenant configurable, erasable on
request (the tenant key makes deletion a single operation).

## 2. The module-side Assistant Data API (what a MODULE implements)

Reference implementation: Technical, `server/modules/assistant-api/`. A module without
these endpoints still gets full documentation answers — this API only adds live-data
answers.

### GET {moduleApi}/assistant/manifest
Header `x-service-secret` (per-module secret shared with the central service).
→ `{ "apiVersion": 1, "module": "technical", "tools": [ {name, description, parameters(JSON-schema)} ] }`
The central service consumes manifests — adding a tool needs no central change.

### POST {moduleApi}/assistant/execute
Headers: `x-service-secret` + `x-assistant-identity` (the caller's token, forwarded
unmodified by the central service — the module re-verifies it and enforces its OWN
scope; LLM-supplied args are never trusted).
Body `{ "tool": "get_work_orders", "args": {…}, "requestId": "…" }`
→ `{ "ok": true, "data": … }` or `{ "ok": false, "error": "plain-language refusal/failure" }`
(HTTP 200 — denials are data the LLM relays politely; 401 reserved for auth).

### GET {moduleApi}/assistant/token  (the mint — rides the user's session)
Converts the module's resolved session into the signed identity the widget attaches
to central calls. → `{ "token": "…", "expiresInSec": 60 }`.
**Contract:** the role is read from the module's REAL forwarded identity (`req.rbac`
in Technical); a session with no real forwarded identity is REFUSED (403) — the mock
fallback can never be laundered into a signed token.

## 3. The signed identity token

`base64url(JSON payload) + "." + base64url(HMAC-SHA256(payloadB64, shared key))`
Payload: `{ userId, userName, role, vesselId?, tenantDomain?, tuid?, iat, exp }`, TTL 60 s.
Verification allows a bounded ±90 s clock-skew leeway (measured 62 s skew between our
own hosts; clock mismatch has caused real incidents in this fleet) and rejects
future-dated tokens beyond it. Implementations: `central-assistant/identity.mjs` (JS)
and `server/modules/assistant-api/identityToken.ts` (TS) — same wire format.

### 3.1 Multi-tenant modules: which tenant does `/assistant/execute` run in? (23/24-Sep-2026)

The central service's call to `POST {moduleApi}/assistant/execute` carries **no SAILERP Bearer** — the
browser's JWT never leaves the browser↔module hop. A multi-tenant module therefore selects the tenant
from the **identity token's `tenantDomain`**, which the module itself copied from the JWT-verified domain
when it minted the token (`GET /assistant/token` runs under the module's tenant middleware). The module
accepts that only together with the shared service secret: **two verified credentials, no exemption, no
browser header trusted for the tenant**. A token without `tenantDomain` (minted by a single-tenant
instance) is refused by a multi-tenant module (`401 invalid_identity`, fail closed). `GET /assistant/manifest`
is static tool metadata and needs the service secret only. Technical's implementation:
`server/modules/assistant-api/serviceTenant.ts`, consulted by `server/middleware/tenantMiddleware.ts`;
regression harness `scripts/verify-assistant-multitenant-auth.ts` (21 checks: mint and execute hops,
tenant/database selection, cross-tenant refusal, missing/expired/tampered credentials, ship shore-only).

### 3.2 What is verified, and by what — the two identities in the token (24-Sep-2026, Option A implemented on the pilot)

| Field(s) | Source | Verified by | Trust |
|---|---|---|---|
| `tenantDomain`, `tuid` | SAILERP login token, `domain` claim | HS256 signature with the shared `JWT_SECRET` (tenantMiddleware) | **Server-verified.** Cannot be set by the browser. |
| `userId`, `role`, `userType` | SAILERP login token claims (`id`, `role`, `userType` — names configurable via `SAILERP_JWT_USER_CLAIMS`), read by tenantMiddleware from the SAME verified token and exposed as `req.verifiedUser` | Same HS256 signature | **Server-verified (Option A, pilot).** The mint reads ONLY these; the browser's `x-user-*` headers, the mock session and `req.rbac` are not consulted. A token missing any of the three claims cannot mint (403, no header fallback). |
| `userName` | Browser profile header | — | Display and masking only; never used for authorisation. |
| `vesselId` | Session (null on the shore) | — | Ship users never reach the shore assistant; a Ship-type identity with no vessel is refused by the tools. |

**Sail Admin restriction is server-enforced.** The mint refuses any VERIFIED role outside
`ASSISTANT_ALLOWED_ROLES` (default `Sail Admin`) with 403 — the hidden button is only the visual half. To
widen access, change the allow-list on the module; the widget gate stays `Sail_Admin` view mode until the
product decides otherwise.

**Scope of Option A.** It changes the assistant token mint only. Technical's own RBAC guards
(`permissions.ts`, controllers) still read `req.rbac` from the profile headers — the module-wide
"mock-identity hardening" backlog item, unchanged here. Single-tenant or `AUTH_BYPASS` instances verify no
token and therefore cannot mint at all (fail closed) — the assistant needs multi-tenant mode, which dev and
production run.

**`userType` — exactly where it comes from.** SAILERP supplies it in the signed login token AND in the
encrypted `userProfile` in local storage (Ghazi, 24-Sep-2026). Since Option A the assistant reads it from the
**token**; the rest of the module still reads the header. The server requires from SAILERP: an HS256 Bearer
signed with the shared `JWT_SECRET` carrying `domain`, and — for the assistant — `id`, `role`, `userType`
(the exact claim names WILL BE confirmed by the §3.3 inspection, still pending; until then they are the Crewing-validated
defaults, and a mismatch shows up as "missing required claim(s)", never as a silent header fallback).

Harness (`scripts/verify-assistant-multitenant-auth.ts`, 24 checks + 3 ship checks): headers claiming another
user id or user type do not change the minted identity; a valid token mints with no headers at all; a token
missing `role` or `userType` is refused; a verified `User` or `Vessel User` role is refused by the allow-list.

### 3.3 Remaining production check — genuine SAILERP session (NOT done; pilot cannot do it)

The pilot has no SAILERP login. Everything above was verified with a test-minted JWT and an emulated
profile. Before live data is enabled in any environment that real users reach, run this once, in that
environment, with a genuine SAILERP login:

1. Log in to SAILERP normally, open the Technical module, open DevTools → Network, pick any
   `/technical/api/...` request. **Do not copy the token anywhere** — not into chat, a report, a ticket or Git.
2. In that same browser console, decode the JWT payload locally and note ONLY the claim NAMES, the `domain`
   value and the expiry (the payload is base64url; the signature is not needed and must not be shared):
   `JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))` where `t` is the Bearer. Record which of
   `domain`, `id`/`userId`, `userType`, `role` are present.
   Expected (Ghazi, 24-Sep): `domain`, user id, `role`, `userType` are all present — the inspection confirms the
   exact names the code will read.
3. Confirm the chat widget mints a token (`GET /technical/api/assistant/token` → 200) on that session and
   that one live-data question answers for a vessel of that tenant. Optionally run the harness's genuine-session
   check on a workstation that already holds the session: `GENUINE_BEARER=<pasted locally, never stored>`
   `GENUINE_DOMAIN=<expected domain>` — it prints claim names only, never the token.
4. Record the outcome in the deployment note (claim names, domain matched yes/no, mint 200 yes/no).

### 3.4 User identity trust — Option A done on the pilot; what remains before production

Before Option A the assistant answered as whoever the browser claimed to be (within the verified tenant).
Two options made `userId` / `role` / `userType` server-verified without a new authentication architecture;
A is implemented on the pilot, B remains available for the module's own guards:

- **A. Trusted token claims — IMPLEMENTED on the pilot (24-Sep-2026, §3.2).** The mint reads user id, role
  and userType from the verified token; headers are ignored; missing claims are refused. Remaining: the §3.3
  inspection confirms the real claim names (set `SAILERP_JWT_USER_CLAIMS` if they differ), then the same
  change deploys with the Data API. Extending the module's own RBAC guards to the verified claims is a
  separate, larger decision.
- **B. Server-side identity lookup.** The tenant database already holds SAILERP's user and role tables:
  `master_users` (columns include `role`, `userType`, `designation`, `department`), `users` (`role`,
  `vesselId`), `admn_role_master` (`assignedRole`), `master_user_vessels` (user ↔ vessel). The mint (and, if
  wanted, the module's guards) can resolve role / user type / assigned vessels by the user id from those
  tables instead of trusting the headers — provided the user id itself is taken from a verified JWT claim
  (option A for the id alone) or matched server-side. Needs a decision on which table is authoritative and
  how fresh it is on the shore (they are synced master data).

Production live-data enablement still needs: (1) the §3.3 genuine-session inspection (claim names), (2) the
deployment decision. Tenant isolation and the assistant's user identity are then both token-verified; the
module's other screens keep their existing header-based RBAC until the hardening backlog item is taken up.

## 4. Deployment configuration (who sets what)

| Where | Setting | Purpose |
|---|---|---|
| Central service (`assistant.env` on the AI server) | `OPENAI_API_KEY` | The assistant's key (embeddings `text-embedding-3-large`; chat `CHAT_MODEL`, released value `gpt-5.6-luna`) |
| | `DATABASE_URL`, `ASSISTANT_INDEX_SET` | Its own Postgres (pgvector) holds the knowledge store; the index set names the released index (`kb-xref-e`). `CHROMA_URL` is a leftover of the retired Node service — unused by the Python service |
| | `IDENTITY_SIGNING_KEY` | Shared with each module backend |
| | `ADMIN_TOKEN` | Admin surface auth (tunnel-only anyway) |
| | `ASSISTANT_CORS_ORIGINS` | The app origins allowed to embed (e.g. `https://dev.sl-sail.com`) |
| | `ASSISTANT_MODULE_APIS` | `{"technical":{"url":"https://dev.sl-sail.com/technical/api","secret":"…"}}` — per-module data APIs; omit a module → docs-only for it |
| Module backend (PM2 env, e.g. Technical dev) | `ASSISTANT_SERVICE_SECRET` | Locks manifest/execute to the central service |
| | `ASSISTANT_IDENTITY_SIGNING_KEY` | SAME value as the service's signing key |
| App client build | `VITE_ASSISTANT_CENTRAL_URL` | The assistant base URL (optional — defaults to `https://assistant.sl-sail.com`) |

| Module backend | `ASSISTANT_ALLOWED_ROLES` | Roles (verified token claim) allowed to obtain an assistant token; default `Sail Admin` |
| Module backend | `SAILERP_JWT_USER_CLAIMS` | Claim names for user id, role, user type in the SAILERP token; default `id,role,userType` — set after the genuine-session inspection if the real names differ |

**Dev / pilot versus production are SEPARATE assistant deployments with separate keys.** Each
environment (pilot, dev, production) runs its own assistant container with its own `IDENTITY_SIGNING_KEY`,
its own `ASSISTANT_MODULE_APIS` pointing only at THAT environment's module URL and secret, and its own
`OPENAI_API_KEY`. The `dev.sl-sail.com` example above is for the dev assistant only — never copy it into the
shared production assistant's environment, and never share a signing key or service secret between
environments (a dev-signed identity must be worthless in production, and vice versa).

To bring live-data answers to an environment: deploy the module build containing its
Data API, set the PM2 values above for THAT environment, add the module to THAT environment's
`ASSISTANT_MODULE_APIS`, restart THAT assistant container. Nothing else.

## 5. Embedding checklist (any module / the SAILERP shell)

1. Mount the chat widget (Technical's `components/chat` + `assistant-widget/` is the
   reference); pass `context.module` = your module id.
2. Ensure your module exposes `GET …/assistant/token` per §2 (or reuse a shell-level
   mint when the shell provides one).
3. That's all for documentation answers. For live data, implement §2's manifest/execute
   per the development guide in `CHATBOT-CENTRAL-SERVICE-PLAN.md` §6.
