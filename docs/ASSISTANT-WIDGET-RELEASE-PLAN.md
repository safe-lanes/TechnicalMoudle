# Assistant release for the shared widget — comparison, checks, rollback

Written 19-Oct-2026. Branch `feature/assistant-widget`. **Not applied.** It needs Ghazi's approval.

## 1. What is live today (checked 19-Oct-2026)

| Item | Live value | How checked |
|---|---|---|
| Container | `sail-assistant-py-v8`, image `sail-assistant-py:v8-fe04a9997`, `127.0.0.1:8051` | `docker ps` |
| Code | commit `fe04a9997`: all 16 files in `app/` match git byte for byte (after normalising line endings) | sha256 of each file, container vs `git show` |
| Database | `sail-assistant-db`, alembic `0013` (= latest migration on the branch) | `alembic_version` |
| Env file | `~/central-assistant/v8-release.env` | — |
| Registered instances | `technical-dev`, `technical-prod`, `technical-demo` | `ASSISTANT_MODULE_INSTANCES` (names only) |
| CORS | dev / sailerp / erp `.sl-sail.com` + localhost 5000/5173 | `ASSISTANT_CORS_ORIGINS` |
| nginx | `assistant.conf` and `safelanes.conf` (`/assistant/`) → `127.0.0.1:8051` | conf read |

**Intervening fixes:** no runtime file changed between live `fe04a9997` and the widget base `60a66054b`. Only release docs and test scripts changed. `origin/feature/chatbot-enterprise` is still `60a66054b`. Nothing needs carrying over.

## 2. Exact changes the release adds (live `fe04a9997` → widget branch)

All additive. **No database migration, no new env variable, no change to `/chat`, Technical's integration or knowledge training.**

| File | Change |
|---|---|
| `app/main.py` | adds `GET /suggestions` (same identity check as `/chat`) and mounts the `/widget` router |
| `app/suggestions.py` + `app/suggestions_catalog.json` | starter questions: catalog of 20 questions (technical 4, crewing 5, audit 4, safety 4, incident 3), each tied to a manual file + section |
| `app/db.py` | two **read-only** helpers: `pair_enabled` (never registers a pair) and `manual_sections` (published manual sections, minus any superseded by published knowledge) |
| `app/widget_static.py` | `GET /widget/<version>/<file>`: only files listed in `integrity.json` with matching hash; immutable cache; public CORS |
| `Dockerfile` | `COPY widget ./widget` |
| `widget/1.0.0/` | the bundle (`.js`, `.mjs`, `integrity.json`, `SHA384SUMS`) |

Tests: pytest 94/94 on the branch.

## 3. Release steps (proposed)

1. Build the image from the approved commit on the AI server (`git archive <sha> central-assistant-py`), tagged `sail-assistant-py:v9-<sha>`.
2. Run `sail-assistant-py-v9` on `127.0.0.1:8052`, with the **same** env file `v8-release.env` and the same database. v8 keeps running on 8051.
3. Run checks C1–C4 directly against `127.0.0.1:8052`.
4. Switch both nginx lines (`assistant.conf`, `safelanes.conf`) from 8051 to 8052, then `nginx -t` and reload.
5. Repeat C1–C3 through `https://assistant.sl-sail.com`, then do C5 and C6.

## 4. Focused checks

| # | Check | Pass when |
|---|---|---|
| C1 | `/health` | same `indexSet`, `chunks`, `prompt.combined`, `chatModel` and `instances` as v8 |
| C2 | `GET /widget/1.0.0/sail-assistant-widget.1.0.0.js` | 200; sha384 = `integrity.json`; `cache-control: immutable`; `access-control-allow-origin: *`; `/widget/1.0.0/integrity.json` → 404 |
| C3 | `GET /suggestions?module=technical` with a `technical-dev` identity | ≤ 6 Technical questions; `module=hr` → `[]`; no identity → 401 |
| C4 | One documentation question via `POST /chat` (technical-dev identity) | answer with a Technical citation, as on v8 |
| C5 | Technical dev site: the existing chat button | answers as before (integration unchanged) |
| C6 | `/kb` screen: a trainer account signs in and lists entries | unchanged (no write performed) |

## 5. Rollback

- Switch both nginx lines back to `127.0.0.1:8051` (v8 still running), then `nginx -t` and reload.
- **No database step:** the release adds no migration and writes nothing new. `pair_enabled` and `manual_sections` are read-only.
- Remove the `v9` container later, once Ghazi agrees.

## 6. Not part of this release

- Registering Crewing or Audit instances and adding their origins to CORS. That happens per module when it connects (see the integration guide, section 1.5).
- Any change to Technical's in-app chat.
