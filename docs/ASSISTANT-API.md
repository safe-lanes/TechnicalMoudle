# SAIL AI Assistant — API Contract & Embedding Guide

**Base URL:** *pending DNS decision (10-Sep-2026)* — the service is deployed on the AI
server (public IP 13.250.51.71) behind nginx + TLS with the admin surface blocked
publicly, but **no public hostname currently resolves to it**; a DNS record is being
requested (recommended: `assistant.sl-sail.com`). Until DNS exists, the service is
reachable only via SSH tunnel / pilot configuration. This document previously published
`graphai.sl-sail.com`, which turned out to have no public DNS record — corrected.
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
  "gate": "answer | clarify | not_documented | disabled | rate_limited | error",
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
`{ ok, collection, chroma, db, llmCalls }` — llmCalls is a process counter used by test
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

## 4. Deployment configuration (who sets what)

| Where | Setting | Purpose |
|---|---|---|
| Central service (`assistant.env` on the AI server) | `OPENAI_API_KEY` | The assistant's dedicated key (embedding + gpt-4o-mini) |
| | `DATABASE_URL`, `CHROMA_URL` | Its own Postgres + the knowledge store |
| | `IDENTITY_SIGNING_KEY` | Shared with each module backend |
| | `ADMIN_TOKEN` | Admin surface auth (tunnel-only anyway) |
| | `ASSISTANT_CORS_ORIGINS` | The app origins allowed to embed (e.g. `https://dev.sl-sail.com`) |
| | `ASSISTANT_MODULE_APIS` | `{"technical":{"url":"https://dev.sl-sail.com/technical/api","secret":"…"}}` — per-module data APIs; omit a module → docs-only for it |
| Module backend (PM2 env, e.g. Technical dev) | `ASSISTANT_SERVICE_SECRET` | Locks manifest/execute to the central service |
| | `ASSISTANT_IDENTITY_SIGNING_KEY` | SAME value as the service's signing key |
| App client build | `VITE_ASSISTANT_CENTRAL_URL` | The assistant base URL — REQUIRED (no baked-in default; unconfigured fails loudly) |

To bring live-data answers to an environment: deploy the module build containing its
Data API, set the two PM2 values, add the module to `ASSISTANT_MODULE_APIS`, restart
the assistant container. Nothing else.

## 5. Embedding checklist (any module / the SAILERP shell)

1. Mount the chat widget (Technical's `components/chat` + `assistant-widget/` is the
   reference); pass `context.module` = your module id.
2. Ensure your module exposes `GET …/assistant/token` per §2 (or reuse a shell-level
   mint when the shell provides one).
3. That's all for documentation answers. For live data, implement §2's manifest/execute
   per the development guide in `CHATBOT-CENTRAL-SERVICE-PLAN.md` §6.
