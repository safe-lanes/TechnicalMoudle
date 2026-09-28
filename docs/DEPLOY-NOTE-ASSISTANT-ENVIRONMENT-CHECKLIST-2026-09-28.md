# Technical assistant (chatbot) — per-environment deployment checklist (28-Sep-2026)

For: whoever enables the chatbot on a Technical environment (dev, production, any future one).
Written after the production go-live on 28-Sep-2026, where one AI-server step was missed and the
chat did not work until it was added (section 6). Companion to
`docs/DEPLOY-NOTE-ASSISTANT-LIVE-DATA-2026-09-24.md` (the code merge) and `docs/ASSISTANT-API.md` §3.

**Never write a key or secret into chat, email, a ticket or Git.** Values in this document are names only.

## 1. How it fits together

- ONE shared assistant serves every environment: `https://assistant.sl-sail.com` (AI server
  13.250.51.71, container `sail-assistant-py-v7`, image `sail-assistant-py:v7-r2`, host port 8046, settings
  file `~/central-assistant/v7.env`). No assistant image per environment.
- The chat widget inside Technical finds the shared assistant by itself — nothing to configure on the
  Technical side for that.
- Each Technical environment is an **instance** on the assistant, with its own id, signing key, service
  secret and callback address. The assistant fetches live data (work orders, …) only from the address
  registered for the instance that issued the user's token — never from an address supplied by the browser.
- The browser calls the assistant directly, so the assistant must also allow that environment's
  **website address** (browser pre-check, "CORS").

| Environment | Instance id | Website address (allowed origin) | Callback address (registry `url`) |
|---|---|---|---|
| Dev | `technical-dev` | `https://dev.sl-sail.com` | `https://dev.sl-sail.com/technical/api` |
| Production | `technical-prod` | `https://sailerp.sl-sail.com` | `https://sailerp.sl-sail.com/technical/api` |

## 2. Generate the two values (once per environment)

Run twice on a trusted machine with Node; first output = signing key, second = service secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Rules: the two values differ from each other; never reuse another environment's values (the assistant
REJECTS an instance whose key or secret is shared — visible as `instancesRejected` on `/health`); keep them in
a private file and move that file directly to the server that needs it.

## 3. Technical server (PM2 environment) — done by the deployer

| Variable | Value |
|---|---|
| `ASSISTANT_INSTANCE_ID` | the instance id from §1 |
| `ASSISTANT_IDENTITY_SIGNING_KEY` | the environment's signing key (§2) |
| `ASSISTANT_SERVICE_SECRET` | the environment's service secret (§2) |
| `ASSISTANT_ALLOWED_ROLES` | `Sail Admin` (comma-separated SAILERP role names to widen) |
| `ASSISTANT_ROLE_FALLBACK` | `profile` on dev and production (decision 25/28-Sep). Unset = role only from `master_users`. |

Then the normal deploy of `replit_dev`: `git pull` → `npm install` (not `npm ci` on Windows) → `npm run build`
→ `pm2 restart SAIL-Technical-App`. Ships need nothing (the assistant is shore-only).

## 4. AI server — done by support (Ghazi / Claude), BOTH steps every time

1. Back up: `cp -p ~/central-assistant/v7.env ~/central-assistant/v7.env.bak-<reason>-<timestamp>`.
2. **Register the instance** — add an entry to `ASSISTANT_MODULE_INSTANCES` (one JSON line):
   `"<instance id>":{"module":"technical","env":"<dev|prod>","url":"<callback address>","secret":"<service secret>","signingKey":"<signing key>"}`
3. **Allow the website** — add the website address to `ASSISTANT_CORS_ORIGINS` (comma-separated).
   ⚠️ This is the step missed on 28-Sep (section 6). Without it the widget is refused by the browser.
4. Recreate the container (a plain `docker restart` does NOT re-read the settings file; a few seconds of
   downtime for every environment):
   ```bash
   docker rm -f sail-assistant-py-v7
   docker run -d --name sail-assistant-py-v7 --network technical-rag-net \
     --env-file ~/central-assistant/v7.env -p 127.0.0.1:8046:8000 --restart unless-stopped \
     sail-assistant-py:v7-r2 sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"
   ```

## 5. Verification — ALL of these, in this order (each proves a different link)

| # | Check | Expected |
|---|---|---|
| 1 | `curl https://assistant.sl-sail.com/health` | `instances` lists the new id; `instancesRejected` is `[]` |
| 2 | Browser pre-check from the website address: `curl -s -o /dev/null -w '%{http_code}' -X OPTIONS -H "Origin: <website address>" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,x-assistant-identity" https://assistant.sl-sail.com/chat` | `200` (an unknown origin must still give `400`) |
| 3 | From the AI server: `GET <callback address>/assistant/manifest` with header `x-service-secret: <service secret>` | `200` with the tools list; a wrong secret gives `401` |
| 4 | Real login in the browser (Sail Admin) → Technical → chat button → "How many overdue work orders does this vessel have?" | Same number as the Overdue tab on Work Orders |
| 5 | "How do I complete a work order?" | Documentation answer with a Source line |
| 6 | Non-Sail-Admin user | No chat button; `/technical/api/assistant/token` → 403 |

Checks 1–3 can be run by support without a login; 4–6 need a real user of that environment.

## 6. What happened on production (28-Sep-2026) — and why

- Registered `technical-prod` (§4 step 2), recreated the container; checks 1 and 3 passed.
- Nilesh deployed production with the §3 values. The chat did not work.
- Assistant log: every widget call refused at the browser pre-check (`OPTIONS /chat 400`). The allowed website
  list held only dev and two local addresses — `https://sailerp.sl-sail.com` was missing.
- **Why it was missed:** the allowed-website list was set up when dev was first connected (it is in every
  assistant settings file on the AI server), and was never written down as a per-environment step — the 24-Sep deploy note lists only the instance
  registration. Verification before handover covered only the server-to-server link (check 3), not the
  browser link (check 2), so the gap was invisible until a real user tried.
- **Fix (28-Sep 08:24 UTC):** added the production website to `ASSISTANT_CORS_ORIGINS` (backup
  `v7.env.bak-cors-20260928082448`), recreated the container. Check 2: production `200`, dev `200`,
  unknown website `400`. Production's page security policy was also checked: the Technical page sets none, so
  the browser is not blocked there (same as dev).
- **Process change:** §4 now has both steps, and §5 check 2 is mandatory before handing over.

## 7. Rollback

- Assistant: restore the latest `v7.env.bak-*` and recreate the container (§4 step 4). Removing an instance
  returns that environment to documentation-only answers; other environments are unaffected.
- Technical: remove the three `ASSISTANT_*` variables and restart PM2 — the widget then shows "unavailable".

## 8. Open items at time of writing

- Production end-to-end test with a real login (§5 checks 4–6) — pending.
- The production key and secret were written into a chat message on 28-Sep; the dev values were pasted in chat
  earlier. Replace both pairs (§2–§4) and re-run §5.
