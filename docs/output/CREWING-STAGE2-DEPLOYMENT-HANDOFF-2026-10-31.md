# Crewing chatbot Stage 2 (live data) — deployment handoff, Crewing DEV only (31-Oct-2026)

Status: branches merged and pushed. **Nothing below is done yet. It needs Ghazi's deployment approval.** No key or secret
value is written in this document; they go through a secure channel, never chat or Git.
Evidence for every check named here: `CREWING-STAGE2-INTEGRATION-CHECK-2026-10-31.md` (same folder).

## 1. Short version

1. Datta deploys `crewing_accounts` on Crewing dev with one new setting, the service secret. Users see no change yet.
2. Support builds a new assistant container from `feature/chatbot-enterprise`, with both safety flags ON. It is started
   beside the live v10 container, checked, then nginx is switched. Crewing dev is still documentation-only at this point.
3. Support adds the Crewing dev data URL and the same service secret to `crewing-dev`. That needs **another new
   container** (the registry is read only when a container is created). Live data is then on, for Crewing dev only.
4. Datta runs the genuine-login test; then Sahil / Sagar run dev acceptance.
5. Rollback to documentation-only = remove **both** the URL and the secret from `crewing-dev`, and recreate the container.

## 2. What is being deployed

| Item | Branch | Code tested on the pilot | Head after push |
|---|---|---|---|
| Crewing | `crewing_accounts` | merge `705cfcbb` (target 782b92935 + trial ec2c42e5e; trial code tested = 4649c86d, ec2c42e5e only removes a test-script default) | `705cfcbb` |
| Assistant | `feature/chatbot-enterprise` | `1483cb185` = pilot image `sail-assistant-py:crewtrial-1483cb185` | the commit adding this handoff; everything after 1483cb185 is documentation only |

Crewing adds no migration and no package. The assistant adds no package and no widget change (widget stays 1.0.1).

## 3. Crewing settings (dev, PM2 env of the Crewing server)

| Setting | Value | Notes |
|---|---|---|
| `ASSISTANT_SERVICE_SECRET` | **new**, from Ghazi (secure channel) | Must be a new random value, not reused anywhere: the assistant drops any registration that shares a secret or key with another. Empty = the live-data endpoints refuse every call |
| `ASSISTANT_INSTANCE_ID` | `crewing-dev` | already set in Stage 1 |
| `ASSISTANT_IDENTITY_SIGNING_KEY` | unchanged | already set in Stage 1 |
| `ASSISTANT_ALLOWED_ROLES` | optional, default `Sail Admin` | the pilot used `Sail Admin,External 1` for permission tests only; do not copy that to dev unless Ghazi decides |
| `ASSISTANT_DATA_TIMEZONE` | optional, default `UTC` | the date used for "expiring", "due", "this month" |
| `ASSISTANT_DATA_STATEMENT_TIMEOUT_MS` | optional, default `5000` | per-query database time limit |
| `VITE_PARENT_LOGIN_URL`, `VITE_ASSISTANT_URL` | as today | the production build stops if `VITE_PARENT_LOGIN_URL` is missing (existing guard) |
| `ASSISTANT_DATA_AS_OF`, `ASSISTANT_TRIAL_ARG_LOG` | **must NOT be set** | pilot test aids (fixed date, argument log); both are ignored when `NODE_ENV=production`, but leave them unset anyway |

New endpoints: `GET /api/v2/assistant/manifest` and `POST /api/v2/assistant/execute`, server-to-server only (service
secret + signed identity). Stage 1's `GET /api/v2/assistant/token` is unchanged.

## 4. Assistant settings (AI server)

- New env file copied from the live `v10-release.env`, plus:
  ```
  ASSISTANT_QUERY_STATE_GUARD=true
  ASSISTANT_MASK_CONVERSATION_MEMORY=true
  ```
  Both default to OFF; the pilot ran with both ON. The query guard acts only on Crewing conversations; Technical live
  data gave identical answers with both ON (12/12 turns, §8.2 of the integration report).
- Step 2 keeps `crewing-dev` as today (module + signing key, no URL, no secret).
- Step 3 adds to the `crewing-dev` entry of `ASSISTANT_MODULE_INSTANCES`:
  - `url` = **`https://dev.sl-sail.com/api/v2`**. Crewing is on the same SAILERP host as Technical (Ghazi, 31-Oct). Its
    API is proxied at the host root `/api/`, not under `/crewing/`. Checked on 31-Oct with unauthenticated GETs:
    - `/api/v2/assistant/token` answered with Crewing's own tenant error (400 "Missing x-tenant-id header");
    - `/crewing/api/...` returns the web page, so it is not the API.

    The assistant calls `<url>/assistant/manifest` and `<url>/assistant/execute`. These two routes go live only after
    step 1. Both are mounted before the tenant check and pick the company from the verified identity. Data point: on
    31-Oct, `/api/health` on dev reported "no database connection" for the default database; Datta confirms whether that
    is normal for the multi-tenant setup.
  - `secret` = the same value as Crewing's `ASSISTANT_SERVICE_SECRET`.
  - URL and secret go in **together**. An entry with only one of them is dropped entirely, and then Crewing users get
    no answers at all, not even documentation answers.

**Changing the registry requires recreating the assistant container.** The env file is read when a container is
created and the registry is cached for the life of the process; `docker restart` keeps the old registry. Use the same
switch as every release: new container on a spare port, check, switch nginx, keep the previous one running for rollback.

## 5. Deployment order

Each step can be rolled back on its own.

1. **Crewing dev (Datta).** Pull `crewing_accounts` at `705cfcbb`, set `ASSISTANT_SERVICE_SECRET`, build, deploy, restart.
   Check: the Crewing button and documentation answers still work as in Stage 1.
2. **Assistant release (support).** Build the image from `feature/chatbot-enterprise`, start it with the two flags and the
   unchanged registry on a spare port beside v10 (`sail-assistant-py-v10`, :8053). Check on that port:
   Technical dev/prod/demo live-data answers, a documentation answer, the suggestions and the widget bundle hash.
   Then switch nginx (`assistant.conf` and `safelanes.conf`) to it. v10 stays running.
3. **Registration (support).** Add `url` + `secret` to `crewing-dev`; recreate the container (as in §4) and switch nginx.
   Check from the AI server: the Crewing dev manifest answers with the service secret, and is refused without it.
4. **Genuine login (Datta).** A Sail Admin, Office user signs in to SAILERP, opens Crewing, opens the chat and asks a
   live question, e.g. "How many crew are on board Vessel 8?". Expected: an answer with figures and the Crewing source.
   Also check:
   - a user with another role sees no button (`/token` returns 403 `role_not_allowed`);
   - a Ship user gets no token;
   - a how-to question still answers from the Crewing manual;
   - signing out removes the button.
5. **Dev acceptance (Sahil / Sagar).** Their examples (kept in `CREWING-STAGE2-DEV-EXAMPLES-REVIEW-2026-10-30.md`), with
   that day's date and records, across the eight areas: documents, assignments, availability, relief due, rest hours,
   rotation approvals, manning, appraisals. The figures are compared with the Crewing screens.

## 6. Rollback

- **Live data off, documentation answers kept (no Crewing redeploy):** remove **both** `url` and `secret` from the
  `crewing-dev` entry, then **recreate the assistant container** with that env file (spare port, check, switch nginx).
  A restart is not enough. Result: Crewing is documentation-only again and the assistant never calls Crewing.
- **Whole assistant release:** switch nginx back to `sail-assistant-py-v10` (:8053), kept running.
- **Crewing:** redeploy `crewing_accounts` at `782b92935`. No migration to revert. Removing `ASSISTANT_SERVICE_SECRET`
  alone also closes the live-data endpoints (they refuse every call); the assistant then falls back to documentation
  answers when the manifest fails.

## 7. Not covered by the pilot (to be shown on dev)

- Genuine SAILERP login, and the real Crewing dev data and company (the pilot used local copies and synthetic cases).
- The public network path from the AI server to Crewing dev (the pilot used an SSH tunnel).
- 133 Crewing API integration tests that need a Crewing server on :5000; they were not executed on either tree. The
  trial does not change those files or the routes they test.
