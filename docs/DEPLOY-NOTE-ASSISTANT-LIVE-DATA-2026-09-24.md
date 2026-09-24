# Deployment note — Technical assistant (chatbot) live data on dev/staging (24-Sep-2026)

For: Nilesh (manual deployment). Branch: `replit_dev` after the merge of `chatbot-enterprise`
(integration verification recorded in `docs/ASSISTANT-PILOT-HANDOFF-2026-09-24.md` and the merge
report). **Nothing in this note touches production or the shared production assistant.**

## 1. What ships in this merge (Technical module)

- Assistant Data API under `/technical/api/assistant/*` (manifest, execute, token mint) — the module side
  of the central assistant's live-data answers. Shore-only: refused on any ship instance.
- Chat widget (Sail Admin view mode) wired to the central assistant only; the legacy embedded chatbot
  routes (`server/modules/chatbot`) are removed.
- Work-order counts in the assistant use the Work Orders screen's own calculation.
- Multi-tenant: assistant service calls select the tenant from the module-signed identity token; the
  token mint reads user id / role / user type from the VERIFIED SAILERP login token (Option A).
- Central assistant service code (`central-assistant-py/`) — built and run as a container on the AI
  server, NOT by PM2. Its deployment is a separate step (§4) and is NOT part of this dev deploy unless
  live data is being switched on for dev.

## 2. Migrations

| Migration | Where it runs | When | Idempotent | Rollback |
|---|---|---|---|---|
| `migrations/master/0003_chatbot_ai_enabled_and_log.sql` — adds `tenants.ai_enabled` (default TRUE) and the `chatbot_interactions` table + 2 indexes | MASTER database only (`MASTER_DATABASE_URL`), applied automatically by `tenantConnectionManager.init()` at boot in multi-tenant mode | First boot after deploy | Yes (`IF NOT EXISTS`) | Additive; leave in place. No data is read from it by the served path. |

No tenant-database migrations. No changes to `shared/schema.ts` or the 001–178 tenant migration series.
Verify after the first boot: `\d tenants` shows `ai_enabled`; `\d chatbot_interactions` exists in the master DB.

## 3. Environment variables (Technical module, PM2 env of the dev shore) — NAMES ONLY

| Variable | Required for | Value source |
|---|---|---|
| `ASSISTANT_SERVICE_SECRET` | Data API: locks manifest/execute to the dev assistant | Generate a new random value for DEV; the same value goes into the dev assistant's `ASSISTANT_MODULE_APIS` |
| `ASSISTANT_IDENTITY_SIGNING_KEY` | Signs the identity token the widget carries to the assistant | MUST equal the DEV assistant's `IDENTITY_SIGNING_KEY`. Never the production assistant's key. |
| `ASSISTANT_ALLOWED_ROLES` | Optional. Roles (verified token claim) allowed to use the assistant | Default `Sail Admin`. Comma-separated SAILERP role names to widen. |
| `SAILERP_JWT_USER_CLAIMS` | Optional. Claim names for user id, role, user type in the SAILERP token | Default `id,role,userType`. Set ONLY if the genuine-session inspection (§6) shows different names. |
| `MASTER_DATABASE_URL`, `JWT_SECRET` | Already set on dev (multi-tenant) — unchanged | — |

Not needed on ships. Not needed on production for this deploy.

## 4. Dev assistant configuration (AI server container) — separate from production

The dev shore must talk to a DEV assistant container, never to the production one
(`sail-assistant-py-cand2`, `assistant.sl-sail.com`).

- Build the assistant image from this merge's `central-assistant-py/` (the `pilot-r5` / `int-a35d409`
  images on the AI server are built from this code).
- Run it as its own container with its own env: `IDENTITY_SIGNING_KEY` (= dev module's
  `ASSISTANT_IDENTITY_SIGNING_KEY`), `ASSISTANT_MODULE_APIS='{"technical":{"url":"https://<dev host>/technical/api","secret":"<dev ASSISTANT_SERVICE_SECRET>"}}'`,
  `ASSISTANT_TOOL_REASONING_EFFORT=none`, `ASSISTANT_INDEX_SET=kb-xref-e`, **`ASSISTANT_DOCS_PROMPT=v5`** (the released prompt; health shows `v5-plain-coverage-2026-09-15`, docs prompt sha `ff9ee87141ac1362`),
  `ASSISTANT_ROUTE_INTENT=on`, `ASSISTANT_HYBRID=rescue`, `ASSISTANT_CROSS_MODULE_GAP=0.25`,
  `ASSISTANT_CROSS_MODULE_SLOTS=2`, `ROUTE_MARGIN=0.07`, `CHAT_MODEL=gpt-5.6-luna`, `OPENAI_API_KEY`,
  `DATABASE_URL` (the assistant's own Postgres), `ASSISTANT_CORS_ORIGINS=https://<dev host>`.
- Expose it on its own dev hostname/port; the client build's `VITE_ASSISTANT_CENTRAL_URL` (§5) points there.
- **Do not add the dev module URL or secret to the production assistant's `ASSISTANT_MODULE_APIS`.**

Rollback of the assistant: stop the dev container; the widget then shows "assistant unavailable".

## 5. Client build settings and build verification

| Setting | Purpose |
|---|---|
| `VITE_ASSISTANT_CENTRAL_URL` | Base URL of the DEV assistant. If unset, the widget defaults to `https://assistant.sl-sail.com` (production, docs-only) — set it for dev so dev users do not hit the shared production assistant. |
| `VITE_STORAGE_SECRET` | Unchanged (existing) |

**Target OS.** The shore server is **Windows** (`C:/GitHub/technical_build`, PM2 `SAIL-Technical-App` →
`dist/index.js`); ships are Windows too (ship-deploy package). Existing shore flow: `git pull origin replit_dev`
→ `npm install` → `npm run build` → `pm2 restart SAIL-Technical-App`. Keep using **`npm install`** on Windows: it
resolves the Windows-only native packages (`@img/sharp-win32-x64`, `@rollup/rollup-win32-x64-msvc`) that the
committed, Linux-generated lockfile does not list. **If `npm ci` is used instead on Windows**, those two
packages are missing and the server fails at start with `Could not load the "sharp" module using the win32-x64
runtime`; the repair is documented in `docs/DEV-WINDOWS-NPM-OPTIONAL-BINARIES.md` (install the two packages
with `--no-save`). Do not commit a lockfile rewritten on Windows.

Verification done for this merge: (a) Windows build of the merged tree — `npm ci` + the two-package repair,
then `npm run build` → `dist/index.js` built, `npx tsc --noEmit` = 289 pre-existing errors, no new errors;
(b) clean Linux `npm ci` of the merged `package.json` + `package-lock.json` in a fresh `node:22-bookworm-slim`
container — installs, `remark-gfm` 4.0.1 and `jspdf` 4.2.1 resolve. New dependency: `remark-gfm` 4.0.1
(Markdown tables in the widget).

## 6. Post-deploy checks (testing team) — dev shore, genuine SAILERP login

1. Log in to SAILERP (Sail Admin), open Technical. The chat button appears bottom-right. For a
   non-Sail-Admin user it does not appear, and a direct call to `/technical/api/assistant/token` returns 403.
2. **Genuine-session inspection (owed since the pilot):** in DevTools → Network, pick any
   `/technical/api/...` request, decode the Bearer payload locally in the console
   (`JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))`) and record ONLY the claim
   names, the `domain` and the expiry. Expected present: `domain`, user id, `role`, `userType`. Never paste
   the token anywhere. If the names differ from `id`, `role`, `userType`, set `SAILERP_JWT_USER_CLAIMS`.
3. Ask: "How many overdue work orders does this vessel have?" — the number must equal the Overdue tab
   badge on the Work Orders screen for the selected vessel.
4. Ask "What's due this week?" — calendar-dated jobs listed; running-hours jobs listed separately with hours.
5. Ask "Show overdue work orders", then "make that readable", then "show more" — table renders, the
   follow-ups continue the same list (rows 11–20 on "show more").
6. Ask "How do I complete a work order?" then "explain step 2" — documentation answer with a Source line,
   then the follow-up explains that step.
7. Change the selected vessel — the chat clears; ask again — the numbers are for the new vessel.
8. On a SHIP instance: no chat button; `GET /technical/api/assistant/manifest` → 403.
9. Regression harness (optional, from a workstation with the dev env values):
   `scripts/verify-assistant-multitenant-auth.ts` (see its header for the variables).

## 7. Rollback (module)

Redeploy the previous `replit_dev` build. The master migration is additive and can stay. Remove the two
assistant PM2 variables if desired (the Data API then answers 401/503 and the widget shows unavailable).

## 8. Known limitations carried into dev

- The module's other screens still take role/user type from the browser profile headers (existing
  behaviour; the assistant token no longer does).
- Genuine SAILERP token claim names not yet inspected (§6 step 2 closes it).

## 9. Pre-existing issue observed during verification — NOT introduced by this merge

**Shore process exits on a Postgres connection timeout inside the daily schedulers.** Twice during the
integration test run (heavy local load), the shore process died with
`Error: Connection terminated due to connection timeout` raised from `ShoreWoDailyScheduler.runSweep`
(`server/services/shoreWoDailyScheduler.ts:71` → `workOrderReconcileRepository.getProvisionedVesselIds`) and
from `MaintenanceOrchestrator.tick` (`server/services/maintenanceOrchestrator.ts:94`). The rejection is not
caught, so Node exits. This code is replit_dev's own (fork commit `ec2ef72af`), untouched by the chatbot
branch. Under PM2 the process restarts, but a slow or saturated database would produce a restart loop. Owner:
Nilesh / Jeevan. Not fixed here (out of scope of this merge); recorded so it is not attributed to the assistant.
