# SAIL AI Assistant — central service (Stage 1)

Documentation answers only, per `docs/CHATBOT-IMPLEMENTATION-PLAN.md` Stage 1 and
`docs/CHATBOT-CENTRAL-SERVICE-PLAN.md` §4.2 (routing gates). No data tools, no widget,
no external exposure. Runs on the AI testing server beside the `technical-chromadb`
knowledge store.

## Files
- `server.mjs` — the service (Node 20, zero npm dependencies). `POST /chat {message}`,
  `GET /health`. `{message, routeOnly:true}` returns the routing decision without an LLM
  call (used by the smoke suite).
- `Dockerfile` — node:20-alpine, no install step.
- `tag-modules.py` — one-shot module-tag stamp on every chunk (filename-prefix derived).
- `smoke-suite.mjs` — Stage 1 proof: retrieval/routing suite + confusion matrix.

## Deploy (AI testing server, internal-only)

```bash
# from the workstation
scp -i <pem> -r central-assistant ubuntu@<ai-test-server>:~/central-assistant
ssh -i <pem> ubuntu@<ai-test-server>
cd ~/central-assistant
docker build -t sail-assistant:stage1 .
docker run -d --name sail-assistant --restart unless-stopped \
  --network technical-rag-net \
  -p 127.0.0.1:8012:8000 \
  -e OPENAI_API_KEY=... \
  -e CHROMA_URL=http://technical-chromadb:8000 \
  sail-assistant:stage1
curl -s http://127.0.0.1:8012/health
```

Port 8012 is a known-free slot on the box; `127.0.0.1` binding keeps it internal-only
(same posture as the knowledge store on 8011). The OpenAI key is the assistant's
DEDICATED key (per-app key policy) — never another application's.

## Test from the workstation

```bash
ssh -i <pem> -N -L 8112:127.0.0.1:8012 ubuntu@<ai-test-server> &
node smoke-suite.mjs http://127.0.0.1:8112
```

## Tuning knobs (env)
`ROUTE_SIM_FLOOR` (default 1.15, L2 distance not-documented floor) ·
`ROUTE_MARGIN` (default 0.05, clarify threshold) · `ROUTE_TOP_K` (10) ·
`ANSWER_CHUNKS` (5) · `CHAT_MODEL` (gpt-4o) · `EMBED_MODEL` (text-embedding-3-large).
