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
| `app/config.py` | registration: `module` + `signingKey` required; `url` + `secret` optional **together**. An entry with neither is documentation-only (stage 1); an entry with one of the two is dropped. Existing Technical entries (all four fields) parse exactly as before. |
| `app/agent.py` | `manifest_for` / `execute_module_tool` make **no HTTP call** for an instance without `url` |
| `Dockerfile` | `COPY widget ./widget` |
| `widget/1.0.0/` | the bundle (`.js`, `.mjs`, `integrity.json`, `SHA384SUMS`) |

Tests: pytest 95/95 on the branch (adds the documentation-only registration test).

**Pilot results, 19-Oct-2026** (widget test container, image `widget-6a3a5c4ba`, documentation-only entries `crewing-pilot` / `audit-pilot`):
- **Control:** the previous image dropped those entries, so their tokens got 401 `unknown-issuer`.
- **New image:** a brand-new Crewing tenant got 5 Crewing starter questions on its first call, before any chat, and that call registered nothing. Audit got its 4 questions.
- **Answers:** the Crewing and Audit questions answered with only own-module citations (10.3 s and 4.6 s).
- **No module calls:** 0 manifest or execute calls were logged.
- **Disabled pair:** a pair switched off by an administrator got `[]` starter questions and its chat was refused (`gate: disabled`). The same tenant's other module still worked. The test row was removed afterwards.

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
| C4b | `/health` `instances` | still `technical-dev`, `technical-prod`, `technical-demo`; `instancesRejected: []` (the existing entries are unaffected by the registration change) |
| C5 | Technical dev site: the existing chat button | answers as before (integration unchanged) |
| C6 | `/kb` screen: a trainer account signs in and lists entries | unchanged (no write performed) |

## 5. Rollback

- Switch both nginx lines back to `127.0.0.1:8051` (v8 still running), then `nginx -t` and reload.
- **No database step:** the release adds no migration and writes nothing new. `pair_enabled` and `manual_sections` are read-only.
- Remove the `v9` container later, once Ghazi agrees.

## 6. Not part of this release

- Registering Crewing or Audit instances and adding their origins to CORS. That happens per module when it connects (see the integration guide, section 1.5).
- Any change to Technical's in-app chat.

## 7. Release log — 19-Oct-2026

| Item | Value |
|---|---|
| Pushed | `origin/feature/assistant-widget` = `64e7f49d5` (no merge into any other branch) |
| Live image | `sail-assistant-py:v9-64e7f49d5` (image id `2ea790124828`, the same build that was pilot-tested as `widget-6a3a5c4ba`), container `sail-assistant-py-v9`, `127.0.0.1:8052`, env `v8-release.env` |
| Switch | nginx `assistant.conf:21` + `safelanes.conf:375` `8051 → 8052`; `nginx -t` OK; reloaded **07:03:42 UTC** |
| Backups | `/etc/nginx/conf.d/assistant.conf.bak-v9-20261019T070341Z`, `safelanes.conf.bak-v9-20261019T070341Z` |
| Rollback | v8 `sail-assistant-py-v8` still running on `127.0.0.1:8051`: copy both backups back (or sed `8052 → 8051`), `nginx -t`, reload. No database step. |

**Pre-switch (v9 direct, :8052):** C1 health identical to v8 · C2 widget file (SRI, immutable, CORS, `integrity.json` 404) · C3 4 Technical / `hr` [] / no identity 401 · C4 documentation answer · Technical live data: Vessel 3, `rsms05102026`, `technical-dev` → 160 overdue = direct execute on `dev.sl-sail.com` 160 · C6 `/kb` byte-identical.

**Post-switch (public `https://assistant.sl-sail.com`):** C1 identical · C2 identical (SRI matches `integrity.json`) · C3 identical · C4 documentation answer · Technical live data: 160 = source 160 (9.6 s) · served by v9 (v8 got 0 requests) · `viqmap.sl-sail.com/assistant/` also → v9 · no v9 errors.

**Not verified by support:** C5, the existing Technical chat button with a genuine SAILERP login. No real user had used the chatbot since the switch, and support cannot sign in as a user. One question from the Technical dev (and prod) site is needed. The checks used a test identity (`release-check-v9`) and left 6 test conversations in the live log.

## 8. Next release (prepared, NOT applied): widget 1.0.1 — v10

**Why:** widget 1.0.1 shows `<br>` in table cells as a line break; no other HTML is rendered. The Crewing stage 1 integration pins 1.0.1, so **this release must go live and be verified before Crewing is enabled.**

| Item | Value |
|---|---|
| Commit | `feature/assistant-widget` `b2ae111e0` (local; push needs approval) |
| Change vs live `64e7f49d5` | **only** `central-assistant-py/widget/1.0.1/` (4 files). No code change, no migration, no env change. `widget/1.0.0/` byte-identical. |
| Image (prepared, not running) | `sail-assistant-py:v10-b2ae111e0`, id `1543f15d6bbc`, the same image that was pilot-tested as `widget-b2ae111e0` |
| 1.0.0 SRI (must stay) | `sha384-Dz8YnW533ZDxdij+nA0olCnp3VYRdi7kPkEpOxhXKilHPneJPVMiQWFwsaVJErWP`: live today = pilot = this value |
| 1.0.1 SRI (new) | `sha384-e2Q1Mm3OiovWmjX/D8EIXFTxKaNbunU2Y2jH0JuaITO2DdarwsW3BxJQrHte4ZMU`: pilot = this value; live today 404 |

**Steps (same method as v9):**
1. Push `feature/assistant-widget` and fast-forward `feature/chatbot-enterprise`.
2. Run `sail-assistant-py-v10` on `127.0.0.1:8053` with `v8-release.env`.
3. On `:8053`, check C1 (health identical to v9) and C2 for **both** versions (SRI as above, immutable, CORS). Run one Technical documentation question and one Technical live-data question.
4. Back up both nginx files (`.bak-v10-<ts>`) and switch `8052 → 8053`; `nginx -t`; reload.
5. **Public hash check** through `https://assistant.sl-sail.com/widget/1.0.0/…` and `/widget/1.0.1/…`. Both SRI values must match the table above. Then repeat C1, one Technical live-data question and the Technical chat button.

**Rollback:** nginx back to `127.0.0.1:8052` (v9 kept running). No database step. 1.0.0 consumers are unaffected either way.
