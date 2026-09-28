# SAIL AI Assistant — module integration guide (Crewing, Audit, Safety, Incident)

Written 24-Sep-2026 after the Technical integration. Technical is the reference implementation; every
step below points at the Technical file to copy or mirror. Contract details: `docs/ASSISTANT-API.md`.

## 0. What you get, in two stages

| Stage | What the user gets | Work on the module | Work on the assistant (Ghazi/support) |
|---|---|---|---|
| **1. Documentation answers** | "How do I …" answers from the module's own manuals, with sources | Chat widget + one token endpoint + 3 PM2 values | Register the instance (id, key, secret). The manuals of Audit, Crewing, Safety and Incident are already indexed (`kb-xref-e`). |
| **2. Live data** | Questions about the module's records (counts, lists, status) | A manifest of tools + an execute endpoint + access rules | Add the module URL to the same registration |

Stage 1 is one to two days per module. Stage 2 depends on how many tools the module wants.

The assistant is **one shared service** for all modules and environments. Each module × environment is a
separate **instance** with its own credentials (`technical-dev`, `crewing-dev`, `crewing-prod`, …). A token
minted by one instance can never obtain another instance's data.

## 1. Stage 1 — documentation answers

### 1.1 The widget (client)

Copy from Technical and rename nothing but the module id:

| File | Purpose |
|---|---|
| `client/src/components/chat/ChatButton.tsx`, `ChatPanel.tsx`, `ChatMessage.tsx`, `SuggestedPrompts.tsx` | The floating button, panel, Markdown rendering (tables need `remark-gfm`), starter questions |
| `client/src/hooks/useChat.ts` | Conversation state; sends `context.module`, the selected vessel and the history; clears on vessel change |
| `client/src/assistant-widget/assistantClient.ts` | Mints the token from the module (`GET …/assistant/token`) and calls the assistant; the assistant URL defaults to `https://assistant.sl-sail.com` |

Changes for another module:

- In `useChat.ts`, set `context.module` to the module id known to the assistant: `crewing`, `audit`,
  `safety` or `incident` (the ids in the assistant's `MODULE_LABELS`). Everything the assistant retrieves
  is scoped by this id.
- `vesselId` / `vesselName` in the context are optional: send them if the module has a vessel selection,
  otherwise omit them.
- Gate the button the way the module gates admin features. Technical shows it to the Sail Admin view mode
  and hides it on ship instances (`useSyncInstanceInfo`). If the module has no ship instances, drop that part.
- Starter prompts: write four to eight questions the module's manual can answer; verify each one against
  the assistant before shipping (Technical did: every prompt answered with a Source line).

### 1.2 The token mint (server) — the only endpoint stage 1 needs

Copy `server/modules/assistant-api/identityToken.ts` (signing, unchanged) and the `handleMintToken` part of
`server/modules/assistant-api/controller.ts` plus its route (`routes.ts`). Rules the mint must keep:

1. **User identity comes from the verified login only.** Technical reads the user id and user type from
   the SAILERP login token that the tenant middleware verified. If the module cannot verify the login, do
   not mint.
   **⚠️ The SAILERP login token carries NO role** (checked on dev with a genuine login, 25-Sep-2026: claims
   `id`, `userType`, `domain` — no `role`). So the role must come from somewhere else. Technical resolves it
   in this order (`server/modules/assistant-api/controller.ts`, `masterUserRepository.ts`):
   1. the token's role claim, if a future SAILERP login ever carries one;
   2. the synced user master data, `master_users.role` for the verified user id (requires the user to exist
      there with a role);
   3. only if `ASSISTANT_ROLE_FALLBACK=profile` is set: the role from the browser's user profile — the same
      trust level as the module's other screens (used on Technical dev, production and demo).
   If none gives a role, refuse to mint (403, with the reason in the log). A module whose **own server
   already knows the user's role** from its session (for example a module running inside SAILERP itself,
   like Audit) should use that server-side role as step 1 instead — confirm with the module owner rather than
   assuming.
2. **Tenant comes from the verified domain** (`tenantDomain`, `tuid`). In multi-tenant mode this is what the
   assistant uses to keep tenants apart.
3. **`iss` = `ASSISTANT_INSTANCE_ID`** of this module instance. Refuse to mint if it is not configured.
4. **Role allow-list**: refuse roles outside `ASSISTANT_ALLOWED_ROLES` (Technical default: `Sail Admin`).
5. **Shore-only**, if the module has ship instances: refuse on a ship (Technical: `shoreOnly` in `routes.ts`,
   using `isShipInstance()`).
6. Token TTL 60 s, signed with `ASSISTANT_IDENTITY_SIGNING_KEY` (HMAC-SHA256, same wire format as
   `identityToken.ts`).

Mount it under the module's API prefix, e.g. `GET /crewing/api/assistant/token`, behind the module's normal
authentication.

### 1.3 Configuration

Module PM2 env (per environment, values never in chat, ticket or Git):

| Variable | Example |
|---|---|
| `ASSISTANT_INSTANCE_ID` | `crewing-dev` (dev), `crewing-prod` (production) |
| `ASSISTANT_IDENTITY_SIGNING_KEY` | 64-hex, unique to this instance |
| `ASSISTANT_SERVICE_SECRET` | 64-hex, unique to this instance (used in stage 2; set it now) |
| `ASSISTANT_ALLOWED_ROLES` | `Sail Admin` or the roles the module wants |
| `ASSISTANT_ROLE_FALLBACK` | `profile` if the role must come from the browser profile (see 1.2 rule 1); leave unset if the module has a server-side role |

Assistant side (Ghazi/support): one registration entry per instance in `ASSISTANT_MODULE_INSTANCES` —
`{"crewing-dev":{"module":"crewing","env":"dev","url":"https://<host>/crewing/api","secret":"…","signingKey":"…"}}`.
A key or secret reused from another instance, or equal to the assistant's shared documentation key, is
rejected at startup and shown on the assistant's `/health` as `instancesRejected`.

**Assistant side, second step — allow the website (easy to miss; it broke Technical production on 28-Sep).**
The browser talks to the assistant directly, so the assistant only answers websites on its allowed list,
`ASSISTANT_CORS_ORIGINS` in the assistant's settings file. The list is by **website address, not by module**:
today it holds `https://dev.sl-sail.com`, `https://sailerp.sl-sail.com` and `https://erp.sl-sail.com` (plus two
local test addresses). A module served from one of those websites (for example `https://dev.sl-sail.com/crewing/`)
is already allowed; only a **new** website address has to be added. After any change to the settings file the
assistant container is recreated (a plain restart does not re-read the file). Step by step, with the commands:
`docs/DEPLOY-NOTE-ASSISTANT-ENVIRONMENT-CHECKLIST-2026-09-28.md`.

### 1.4 Stage 1 acceptance

1. Widget appears for an allowed role; token endpoint returns 200 with `iss` set; 403 for other roles.
   Also test a user whose role is only in master data (or only in the browser profile) — the path real
   SAILERP logins take, because the login token has no role.
2. Browser pre-check from the module's website: `curl -s -o /dev/null -w '%{http_code}' -X OPTIONS
   -H "Origin: <website address>" -H "Access-Control-Request-Method: POST"
   -H "Access-Control-Request-Headers: content-type,x-assistant-identity" https://assistant.sl-sail.com/chat`
   → `200` (an unknown website stays `400`). Server-side checks alone do NOT prove the widget works.
3. A "How do I …" question from the module's manual answers with a `Source:` line naming the manual.
4. A question the manual does not cover returns the "not covered" answer, not an invention.
5. Tampered or expired token → 401 from the assistant.

## 2. Stage 2 — live data

### 2.1 What to build (mirror Technical)

| Piece | Technical reference | What it does |
|---|---|---|
| Tool definitions | `server/services/chatbotService.ts` — `CHATBOT_TOOLS` | Name, description, JSON-schema parameters per tool. Keep tools small and factual (counts, lists with a limit and `offset`, one record by id). Descriptions are what the model reads. |
| `GET …/assistant/manifest` | `controller.ts` — `handleManifest` | Returns `{apiVersion: 1, module, tools}`; guarded by `x-service-secret` |
| `POST …/assistant/execute` | `controller.ts` — `handleExecute` → `executeTool` | Verifies secret + signed identity, checks the identity's `iss` is this instance, applies access rules, runs the tool, returns `{ok, data}` or `{ok:false, error}` (denials are data, HTTP 200) |
| Tenant selection for service calls | `server/modules/assistant-api/serviceTenant.ts` + the hook in `server/middleware/tenantMiddleware.ts` | The service call carries no browser login; the tenant comes from the signed identity's `tenantDomain` plus the secret |
| Access rules | `executeTool` in `chatbotService.ts` | Resolve ids before checking; refuse unknown records explicitly (never "zero"); vessel scope by verified user type; audit line with the actual tool arguments |

Rules that apply to every module:

- Use the same calculation the module's screens use. Technical's overdue count reuses the Work Orders
  screen's own tab calculation, so the assistant and the screen never disagree.
- Never invent a date or a reason; return the underlying facts (Technical returns due and current running
  hours and the lead-time basis instead of a guessed date).
- Return an explicit error for an unknown or unauthorised record; the assistant relays it as such.
- Page long lists (`limit`, `offset`) so "show more" works.
- Do not send secrets, personal data beyond what the answer needs, or free-text notes the user should not see.

### 2.2 Configuration for stage 2

Only the registration's `url` on the assistant needs to be set (Ghazi/support). The module already has the
secret from stage 1.

### 2.3 Stage 2 acceptance (copy Technical's harnesses)

- `scripts/verify-assistant-multitenant-auth.ts` — 29 checks: mint refusals, execute refusals, tenant
  selection, cross-tenant refusal, role allow-list, other-instance refusal, shore-only. Adapt the module
  base path and one expected number.
- `central-assistant-py/scripts/verify_env_routing_pilot.py` — two environments through one assistant.
- Through the real widget: one correct live answer that matches the screen, one valid zero result, one
  unknown record, one unauthorised record, one documentation question, one follow-up.

## 3. Things that are already done for you

- Manuals of Audit, Crewing, Safety and Incident are indexed and routed by module; cross-references between
  manuals are resolved.
- Masking: names and ids are replaced by tokens before anything reaches the model and restored afterwards.
- Follow-up memory, tables, vessel-change reset, rate limiting, per-tenant on/off switch on the assistant.
- The identity token format, the environment routing and the credential-reuse validation.

## 4. Order of work suggested

1. Crewing dev, stage 1 (widget + mint + 3 PM2 values) → register `crewing-dev` → acceptance 1.4.
2. Audit dev, stage 1, same way.
3. Decide per module which live-data questions matter; build stage 2 for that list only.
4. Production instances (`…-prod`) are registered with their own keys, never by copying dev values.

Genuine-login finding (dev, 25-Sep-2026), applies to every module on the SAILERP login: the token carries
`id`, `userType` and `domain` but **no role** — see 1.2 rule 1. Updated 28-Sep-2026 with the allowed-website
step after the Technical production go-live.
