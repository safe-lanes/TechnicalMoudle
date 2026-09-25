# Deployment note — Technical assistant (chatbot) live data on dev/staging (24-Sep-2026)

For: Nilesh (manual deployment). Branch: `replit_dev` after the merge of `chatbot-enterprise`
(integration verification recorded in `docs/ASSISTANT-PILOT-HANDOFF-2026-09-24.md` and the merge
report). The assistant service itself is handled separately on the AI server (§4).

## 1. What ships in this merge (Technical module)

- Assistant Data API under `/technical/api/assistant/*` (manifest, execute, token mint) — the module side
  of the central assistant's live-data answers. Shore-only: refused on any ship instance.
- Chat widget (Sail Admin view mode) wired to the central assistant only; the legacy embedded chatbot
  routes (`server/modules/chatbot`) are removed.
- Work-order counts in the assistant use the Work Orders screen's own calculation.
- Multi-tenant: assistant service calls select the tenant from the module-signed identity token; the
  token mint reads user id / role / user type from the VERIFIED SAILERP login token (Option A).
- Central assistant service code (`central-assistant-py/`) — built and run as a container on the AI
  server, NOT by PM2 — one shared service for all environments (§4).

## 2. Migrations

| Migration | Where it runs | When | Idempotent | Rollback |
|---|---|---|---|---|
| `migrations/master/0003_chatbot_ai_enabled_and_log.sql` — adds `tenants.ai_enabled` (default TRUE) and the `chatbot_interactions` table + 2 indexes | MASTER database only (`MASTER_DATABASE_URL`), applied automatically by `tenantConnectionManager.init()` at boot in multi-tenant mode | First boot after deploy | Yes (`IF NOT EXISTS`) | Additive; leave in place. No data is read from it by the served path. |

No tenant-database migrations. No changes to `shared/schema.ts` or the 001–178 tenant migration series.
Verify after the first boot: `\d tenants` shows `ai_enabled`; `\d chatbot_interactions` exists in the master DB.

## 3. Environment variables (Technical module, PM2 env of the dev shore) — NAMES ONLY

| Variable | Required for | Value source |
|---|---|---|
| `ASSISTANT_INSTANCE_ID` | Names this Technical instance to the shared assistant (`technical-dev` on dev, `technical-prod` on production) | Fixed per environment; must match the entry registered on the assistant (§10 B) |
| `ASSISTANT_SERVICE_SECRET` | Data API: locks manifest/execute to the shared assistant | This environment's own value, handed over by Ghazi/support; registered on the assistant under the same instance id |
| `ASSISTANT_IDENTITY_SIGNING_KEY` | Signs the identity token the widget carries to the assistant | This environment's own key, registered on the assistant under the same instance id (handed over by Ghazi/support, never in chat or Git). Dev and production keys are different. |
| `ASSISTANT_ALLOWED_ROLES` | Optional. Roles (verified token claim) allowed to use the assistant | Default `Sail Admin`. Comma-separated SAILERP role names to widen. |
| `SAILERP_JWT_USER_CLAIMS` | Optional. Claim names for user id, role, user type in the SAILERP token | Default `id,role,userType`. Dev inspection 25-Sep: the token has `id` and `userType` but NO role — the role is taken from `master_users` (synced SAILERP master data) by the verified user id. **Every assistant user must exist in `master_users` with a role**; check `select id, role, user_type from master_users where id='<user id>'`. |
| `MASTER_DATABASE_URL`, `JWT_SECRET` | Already set on dev (multi-tenant) — unchanged | — |

Not needed on ships.

## 4. The assistant is ONE shared service for every environment (decision: Ghazi, 24-Sep-2026)

A single central assistant, `https://assistant.sl-sail.com`, serves dev and production. Each Technical
environment is **registered** on it as an instance with its own signing key, secret and exact callback URL
(`docs/ASSISTANT-API.md` §3.5). Done on the AI server by Ghazi/support, not by the deployer:

1. Switch the shared assistant to the image built from this code (`central-assistant-py`).
2. Register the instance: add `technical-dev` (and later `technical-prod`) to `ASSISTANT_MODULE_INSTANCES`
   with that environment's URL, secret and signing key. The three module values of §3 are the same values.

Each environment's token reaches only its own registered endpoint; a dev token can never obtain production
data and vice versa. Documentation answers are unaffected.

## 5. Client build settings and build verification

| Setting | Purpose |
|---|---|
| `VITE_ASSISTANT_CENTRAL_URL` | Not needed: the widget defaults to the shared assistant `https://assistant.sl-sail.com`. Set only if the assistant ever moves. |
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
2. **Genuine-session inspection — DONE on dev 25-Sep-2026** (token claims: `id`, `userType`, `domain`; no `role` → role resolved from `master_users`). Kept for reference: in DevTools → Network, pick any
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

## 10. Assistant rollout — SEPARATE deployment actions (A and B EXECUTED 24-Sep-2026 12:10 UTC after the dev deploy: shared assistant now `sail-assistant-py-v7` v7-r2 on :8046, `technical-dev` registered; rollback container `-cand2` :8041 kept; nginx backups `*.bak-8041-20260924121014`)

These are not part of the code merge. Both are done on the AI server by Ghazi/support. The production assistant
stays as it is until step A is executed.

### A. Switch the shared assistant to the new image

1. Build: on the AI server, `~/build-…` from this merge's `central-assistant-py` →
   `docker build -t sail-assistant-py:v7-r2 .` (the image must show `"instances": []` and no
   `REGISTRY REJECTED` lines when started with the current env — documentation-only behaviour identical).
2. Env: copy the live container's env to `~/central-assistant/v7.env`; keep every existing value; REMOVE
   `ASSISTANT_MODULE_APIS` (retired); leave `IDENTITY_SIGNING_KEY` (shared documentation key) as it is.
3. Start beside the live one: `docker run -d --name sail-assistant-py-v7 --network technical-rag-net
   --env-file ~/central-assistant/v7.env -p 127.0.0.1:8046:8000 --restart unless-stopped sail-assistant-py:v7-r2
   sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"`.
   Check `curl 127.0.0.1:8046/health` → same `indexSet`/`docsPromptSha` as 8041, `instances: []`.
4. Back up and switch nginx: the two assistant upstreams (`assistant.conf`, `safelanes.conf` — the same two
   lines changed on 23-Sep) from 8041 to 8046; `nginx -t`; reload.
5. Post-switch checks through the public URL: health; a documentation question with a no-issuer token → answer
   with citations; the routing + retrieval quick suites (13 + 18) against the public path.
6. Keep `sail-assistant-py-cand2` (8041) running for rollback.

**Rollback A:** point the two nginx upstreams back to 8041, reload. Nothing else to undo.

### B. Register `technical-dev` (after the dev shore is deployed with §3 values)

1. Generate the dev instance's signing key and service secret (never in chat, ticket or Git). Put the same
   values into the dev shore PM2 env (`ASSISTANT_INSTANCE_ID=technical-dev`, `ASSISTANT_IDENTITY_SIGNING_KEY`,
   `ASSISTANT_SERVICE_SECRET`) and restart the dev shore.
2. Add to `~/central-assistant/v7.env`:
   `ASSISTANT_MODULE_INSTANCES={"technical-dev":{"module":"technical","env":"dev","url":"https://<dev host>/technical/api","secret":"…","signingKey":"…"}}`
   — the key MUST differ from `IDENTITY_SIGNING_KEY` and from every other instance's key/secret, or the instance
   is rejected at startup (visible as `instancesRejected` on `/health`).
3. Restart the v7 container; `/health` must show `"instances": ["technical-dev"]`, `"instancesRejected": []`.
4. Checks: dev widget → mint 200 (token `iss: technical-dev`) → one live question matches the Work Orders
   screen; the dev shore log shows `[assistant-api] execute …`; a documentation question still answers.

**Rollback B:** remove the entry from `ASSISTANT_MODULE_INSTANCES` and restart the v7 container (dev returns to
documentation-only); or rollback A entirely.

Later, `technical-prod` is registered the same way with its own key and secret — never by copying dev's values.
