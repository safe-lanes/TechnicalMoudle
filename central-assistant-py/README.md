# SAIL AI Assistant — central service (Python/FastAPI, Stage 5-PORT)

Python port of `central-assistant/` (Node) on the stack ruled in
`docs/CHATBOT-PYTHON-PORT-PLAN.md` §S: FastAPI · **Pydantic AI** (agent/tool loop) ·
**pgvector** in the service's own Postgres (Chroma server retired) · SQLAlchemy 2 async +
Alembic · Postgres-backed rate limiter · HMAC identity token (wire-compatible with Node/TS).
Same HTTP contract as before — `docs/ASSISTANT-API.md` is unchanged.

## Layout
```
app/config.py      env knobs (same names as the Node service; one assistant.env drives both)
app/main.py        FastAPI routes: POST /chat, /rate · GET /health, / · /admin/*
app/chat.py        gate order: identity → rate limit → pair (self-register / kill switch) → redirect → loop | docs
app/agent.py       Pydantic AI loop — G1 tool budget, G2 soft deadline → partial, G3 masking choke point, G4 un-mask args
app/retrieval.py   §4.2 routing gates (unchanged thresholds), known-redirect table (§X), docs prompt
app/masking.py     one choke point per direction; bracket-tolerant token restore (spike finding)
app/identity.py    HMAC-SHA256 b64url token verify (+ test mint), ±90 s skew leeway
app/db.py          SQLAlchemy async engine (pool 20) + explicit SQL; pgvector search; rate limiter
app/llm.py         the OpenAI client: llmCalls counter + ASSISTANT_CAPTURE_OUTBOUND wire capture (hooks)
alembic/           0001 baseline (Stage-2 tables, IF NOT EXISTS) · 0002 pgvector chunks · 0003 rate hits
indexer/           migrate_chroma_to_pgvector.py (one-shot, no re-embed)
tests/             pytest: masking (incl. bracket regression), identity (incl. Node-minted fixture), routing/redirects
spike/             the §S.1 Pydantic AI spike (kept as the record of the decision)
```

## Run locally
```bash
uv sync                      # Python 3.12+, pins in uv.lock
uv run pytest -q             # 28 unit tests, no network
uv run ruff check . && uv run mypy app
DATABASE_URL=... IDENTITY_SIGNING_KEY=... ADMIN_TOKEN=... OPENAI_API_KEY=... \
  uv run alembic upgrade head && uv run uvicorn app.main:app --port 8013
```

## Deploy (AI server, internal-only binding; nginx in front)
```bash
docker build -t sail-assistant-py:<tag> .
docker run -d --name sail-assistant-py --restart unless-stopped --network technical-rag-net \
  -p 127.0.0.1:8015:8000 --env-file ~/central-assistant/assistant.env sail-assistant-py:<tag>
```
Port **8015**, not 8013/8014: `safelanes.conf` still carries stale `/maran/*` and `/osm/*`
locations pointing at 8013/8014 (the retired v1.5 chat bots) — binding there would put the
assistant behind those dead public paths. The container runs `alembic upgrade head` then uvicorn. `sail-assistant-db` must be the
`pgvector/pgvector:pg16` image (swapped 11-Sep-2026; the old alpine container is kept
stopped as `sail-assistant-db-alpine` for rollback, dump in `~/central-assistant/`).

## Proof (all re-run against this service, 11-Sep-2026)
smoke 18/18 (0 misrouted, matrix identical to Node) · stage2 16/16 (incl. exact 5-of-35 rate
limit on the Postgres limiter) · parity 22/22 (pilot Data API + tool loop) · redirect gate
3/3 with zero LLM calls · captured OpenAI wire: 0 of 18 real fleet names, 68 tokens.
Suites live in `../central-assistant/*.mjs` (HTTP clients; they need no port).
