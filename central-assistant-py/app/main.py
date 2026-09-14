"""
SAIL AI Assistant — central service (Python/FastAPI port of central-assistant/server.mjs).
Same HTTP surface, byte-for-byte contract (docs/ASSISTANT-API.md):
  POST /chat · POST /rate · GET /health · GET / (landing) · /admin/* (x-admin-token)
"""
from __future__ import annotations

import hashlib
import html
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from . import agent, chat, db, llm, retrieval
from .config import settings
from .identity import verify_identity


def prompt_record() -> dict[str, str]:
    """What answer prompts are running: label + content hashes (docs path system prompt for a
    fixed dummy routing, and the tool-loop instructions). Any wording change changes the hash."""
    sys_text, _ = retrieval.docs_prompt("Q", retrieval.Routed("answer", hits=[db.Hit(meta={"file": "F.pdf", "breadcrumb": "F > S"}, text="T", distance=0.5, module="technical")], module="technical"))
    h1 = hashlib.sha256(sys_text.encode()).hexdigest()[:16]
    h2 = hashlib.sha256(agent.TOOL_LOOP_INSTRUCTIONS.encode()).hexdigest()[:16]
    return {"version": agent.PROMPT_VERSION, "docsPromptSha": h1, "toolLoopPromptSha": h2, "combined": hashlib.sha256((h1 + h2).encode()).hexdigest()[:16]}

app = FastAPI(title="SAIL AI Assistant", docs_url=None, redoc_url=None, openapi_url=None)

_cors = settings().cors_origins
if _cors:
    app.add_middleware(CORSMiddleware, allow_origins=["*"] if "*" in _cors else _cors, allow_credentials=False,
                       allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type", "x-assistant-identity", "x-admin-token"], max_age=600)


async def _json_body(request: Request) -> dict[str, Any]:
    try:
        raw = await request.body()
        j = (await request.json()) if raw else {}
        return j if isinstance(j, dict) else {}
    except Exception:
        return {}


# ── landing + health ──────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def landing() -> str:
    db_ok = await db.ping()
    try:
        chunks = await db.chunk_count()
    except Exception:
        chunks = 0
    ok = db_ok and chunks > 0
    return f"""<!doctype html><html><head><title>SAIL AI Assistant</title>
<style>body{{font-family:system-ui,Segoe UI,Arial;max-width:640px;margin:8vh auto;padding:0 20px;color:#1a2b45}}
h1{{font-size:1.6rem}}code{{background:#f0f3f8;padding:2px 6px;border-radius:4px}}
.ok{{color:#0a7d33;font-weight:600}}.bad{{color:#b00020;font-weight:600}}
li{{margin:6px 0}}footer{{margin-top:2rem;color:#667;font-size:.85rem}}</style></head><body>
<h1>SAIL AI Assistant</h1>
<p>Status: <span class="{'ok' if ok else 'bad'}">{'RUNNING' if ok else 'DEGRADED'}</span>
&nbsp;&middot;&nbsp; knowledge store: {html.escape(f'{chunks} chunks') if chunks else 'unreachable'} &nbsp;&middot;&nbsp; database: {'connected' if db_ok else 'unreachable'}</p>
<p>This is an API service &mdash; it powers the chat window inside the SAIL applications.
It answers from the official module user manuals (Technical, Audit, Safety, Incident, Crewing)
and, where connected, live module data.</p>
<ul>
<li><code>POST /chat</code> &mdash; conversational endpoint (signed identity required)</li>
<li><code>POST /rate</code> &mdash; answer feedback (signed identity required)</li>
<li><code>GET /health</code> &mdash; machine-readable status</li>
</ul>
<footer>Safe Lanes &middot; internal enterprise service &middot; contract: docs/ASSISTANT-API.md</footer>
</body></html>"""


@app.get("/health")
async def health() -> dict[str, Any]:
    db_ok = await db.ping()
    try:
        chunks = await db.chunk_count()
    except Exception:
        chunks = None
    return {"ok": True, "store": "pgvector", "indexSet": settings().assistant_index_set, "chunks": chunks,
            "db": "connected" if db_ok else "unreachable", "llmCalls": llm.llm_calls, "prompt": prompt_record()}


# ── admin (nginx denies publicly; tunnel-only) ─────────────────────────────────────
def _admin_ok(request: Request) -> bool:
    tok = settings().admin_token
    return bool(tok) and request.headers.get("x-admin-token") == tok


@app.get("/admin/pairs")
async def admin_pairs(request: Request) -> Any:
    if not _admin_ok(request):
        return JSONResponse({"error": "admin token required"}, status_code=401)
    return JSONResponse(_jsonable(await db.list_pairs()))


@app.post("/admin/pairs/toggle")
async def admin_toggle(request: Request) -> Any:
    if not _admin_ok(request):
        return JSONResponse({"error": "admin token required"}, status_code=401)
    b = await _json_body(request)
    row = await db.toggle_pair(str(b.get("tenantDomain") or ""), str(b.get("module") or ""), b.get("enabled") is True)
    return JSONResponse(_jsonable(row)) if row else JSONResponse({"error": "pair not found"}, status_code=404)


@app.get("/admin/notifications")
async def admin_notifications(request: Request) -> Any:
    if not _admin_ok(request):
        return JSONResponse({"error": "admin token required"}, status_code=401)
    return JSONResponse(_jsonable(await db.list_notifications()))


@app.get("/admin/conversations/count")
async def admin_conv_count(request: Request) -> Any:
    if not _admin_ok(request):
        return JSONResponse({"error": "admin token required"}, status_code=401)
    return {"count": await db.conversation_count()}


# ── chat / rate ───────────────────────────────────────────────────────────────────
@app.post("/chat")
async def post_chat(request: Request) -> Any:
    s = settings()
    tok = request.headers.get("x-assistant-identity")
    v = verify_identity(tok, s.identity_signing_key, s.identity_clock_leeway_sec)  # §5.3: before anything else
    if not v.ok or v.identity is None:
        return JSONResponse({"error": f"identity rejected: {v.reason}"}, status_code=401)
    try:
        status, payload = await chat.handle_chat(await _json_body(request), v.identity, tok or "")
        return JSONResponse(payload, status_code=status)
    except Exception as e:
        print(f"[assistant] {e}")
        return JSONResponse(chat.GENERIC_ERR, status_code=200)


@app.post("/rate")
async def post_rate(request: Request) -> Any:
    s = settings()
    v = verify_identity(request.headers.get("x-assistant-identity"), s.identity_signing_key, s.identity_clock_leeway_sec)
    if not v.ok or v.identity is None:
        return JSONResponse({"error": f"identity rejected: {v.reason}"}, status_code=401)
    b = await _json_body(request)
    rating = b.get("rating")
    if rating not in (1, -1):
        return JSONResponse({"error": "rating must be 1 or -1"}, status_code=400)
    await db.insert_rating(b.get("conversationId"), int(rating), str(v.identity.get("userId")), b.get("note"))
    return {"ok": True}


@app.exception_handler(404)
async def not_found(request: Request, exc: Any) -> JSONResponse:
    return JSONResponse({"error": "not found"}, status_code=404)


def _jsonable(v: Any) -> Any:
    if isinstance(v, list):
        return [_jsonable(x) for x in v]
    if isinstance(v, dict):
        return {k: _jsonable(x) for k, x in v.items()}
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v
