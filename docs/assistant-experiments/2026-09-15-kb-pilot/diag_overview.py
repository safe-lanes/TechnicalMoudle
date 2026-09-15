"""Overview-only diagnostic (owner GO, 15-Sep-2026). Runs INSIDE the prompt-v2 candidate container (sail-assistant-py-exp2,
index set kb-pilot) so the prompt text, model, settings and masking path are exactly the served ones.

Two questions x two arms x 3 runs:
  arm NORMAL   — the real serving path: app.chat.handle_chat(...) (rate limit, pair, redirect, embed -> retrieve -> route ->
                 docs_prompt -> agent.answer_docs) with the acceptance test identity; identical to POST /chat minus the HTTP layer.
  arm OVERVIEW — the same docs path, but `routed` replaced by a single hit: the complete overview chunk
                 (how-work-orders-are-created.md, one chunk) fetched from the same index set. Everything else unchanged.
When ASSISTANT_CAPTURE_OUTBOUND is set for THIS process, app.llm appends the ACTUAL wire body of every outbound OpenAI
request (embeddings + chat) to that file; the line range of each run is recorded so bodies map to runs.
Writes /app/out/diag-results.json.
"""
import asyncio
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, "/app")
from sqlalchemy import text  # noqa: E402

from app import agent, chat, db, retrieval  # noqa: E402
from app.config import settings  # noqa: E402
from app.masking import Masker  # noqa: E402

QUESTIONS = [("wo-generic-01", "How do I create a work order?"), ("wo-phr-01", "What are the different ways to create a work order in PMS?")]
RUNS = 3
CAP = os.environ.get("ASSISTANT_CAPTURE_OUTBOUND", "")
OUT = "/app/out/diag-results.json"
_n = 0


def identity() -> dict:
    global _n
    _n += 1
    return {"userId": f"diag-{_n}", "userName": "Acceptance", "role": "Sail Admin", "tenantDomain": "smoke-suite-tenant"}


def cap_lines() -> int:
    try:
        with open(CAP, encoding="utf-8") as f:
            return sum(1 for _ in f)
    except FileNotFoundError:
        return 0


async def overview_hit() -> db.Hit:
    async with db.engine().connect() as c:
        rows = list(await c.execute(text(
            "SELECT module, file, section_title, breadcrumb, metadata, content FROM assistant_chunks "
            "WHERE index_set=:s AND CAST(metadata AS text) LIKE '%how-work-orders-are-created%'"), {"s": settings().assistant_index_set}))
    assert len(rows) == 1, f"expected exactly one overview chunk, got {len(rows)}"
    m = dict(rows[0]._mapping)
    meta = dict(m.get("metadata") or {})
    for k in ("file", "breadcrumb", "section_title", "module"):
        meta.setdefault(k, m.get(k))
    return db.Hit(meta=meta, text=m.get("content") or "", distance=0.0, module=str(m.get("module") or "technical").lower())


async def index_identity() -> dict:
    s = settings()
    out: dict = {"index_set": s.assistant_index_set}
    async with db.engine().connect() as c:
        out["chunks"] = int((await c.execute(text("SELECT count(*) FROM assistant_chunks WHERE index_set=:s"), {"s": s.assistant_index_set})).scalar_one())
        out["by_source"] = {str(r[0]): int(r[1]) for r in await c.execute(text(
            "SELECT COALESCE(metadata->>'source','(none)'), count(*) FROM assistant_chunks WHERE index_set=:s GROUP BY 1"), {"s": s.assistant_index_set})}
        try:
            out["build_records"] = [dict(r._mapping) for r in await c.execute(text("SELECT * FROM assistant_index_builds WHERE index_set=:s ORDER BY 1 DESC LIMIT 3"), {"s": s.assistant_index_set})]
        except Exception as e:  # table may not exist — record that, do not fail
            out["build_records"] = f"not available: {type(e).__name__}"
    return out


async def arm_overview(q: str, hit: db.Hit) -> dict:
    s = settings()
    ident = identity()
    tenant = ident["tenantDomain"]
    masking_on = s.masking_enabled and tenant not in s.masking_disabled_tenants
    masker = Masker() if masking_on else None
    if masker:
        masker.register(ident["userName"], "PERSON")
    routed = retrieval.Routed("answer", hits=[hit], module="technical")
    system, user = retrieval.docs_prompt(q, routed)
    t0 = time.monotonic()
    answer, usage = await agent.answer_docs(system, user, masker)
    return {"identity": ident, "masking_on": masking_on, "system": system, "user": user, "answer": answer, "usage": usage,
            "citations": retrieval.citations_of(routed), "latency_ms": int((time.monotonic() - t0) * 1000)}


async def arm_normal(q: str) -> dict:
    ident = identity()
    t0 = time.monotonic()
    code, resp = await chat.handle_chat({"message": q, "context": {"module": "technical"}}, ident, "")
    return {"identity": ident, "http_status": code, "response": resp, "latency_ms": int((time.monotonic() - t0) * 1000)}


async def main() -> None:
    s = settings()
    health = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=10).read().decode("utf-8"))
    hit = await overview_hit()
    record = {
        "ran_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "container_hostname": os.uname().nodename,
        "health": health,
        "settings": {"chat_model": s.chat_model, "answer_chunks": s.answer_chunks, "route_top_k": s.route_top_k,
                     "route_sim_floor": s.route_sim_floor, "route_margin": s.route_margin, "masking_enabled": s.masking_enabled,
                     "model_settings": dict(agent._model_settings()), "llm_timeout_ms": s.llm_timeout_ms},
        "index": await index_identity(),
        "overview_chunk": {"meta": {k: v for k, v in hit.meta.items() if k != "kb_sources"}, "chars": len(hit.text), "text": hit.text},
        "capture_file": CAP or None,
        "runs": [],
    }
    for cid, q in QUESTIONS:
        for arm in ("normal", "overview"):
            for r in range(1, RUNS + 1):
                start = cap_lines()
                res = await arm_normal(q) if arm == "normal" else await arm_overview(q, hit)
                res.update({"case": cid, "question": q, "arm": arm, "run": r, "capture_lines": [start, cap_lines()]})
                record["runs"].append(res)
                ans = res["response"]["response"] if arm == "normal" else res["answer"]
                print(f"[{cid}] {arm} run {r}: capture lines {res['capture_lines']} · {len(ans)} chars · {ans[:100]!r}", flush=True)
                await asyncio.sleep(0.5)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=1)
    print("written", OUT)


asyncio.run(main())
