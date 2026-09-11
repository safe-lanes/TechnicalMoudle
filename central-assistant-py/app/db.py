"""
The service's OWN Postgres store — pairs matrix, conversation log, ratings,
notifications, and (since the port) the knowledge chunks (pgvector) and the
rate-limit hits. Local service DB — never a tenant DB, never synced.

Schema is owned by Alembic (alembic/versions) — nothing here creates tables.
Queries are explicit SQL via SQLAlchemy Core `text()` on an async engine
(asyncpg), pool size from settings (20; was 5 in Node — Audit-4 fix).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from .config import settings


@lru_cache(maxsize=1)
def engine() -> AsyncEngine:
    s = settings()
    return create_async_engine(s.sqlalchemy_url, pool_size=s.db_pool_size, max_overflow=5, pool_pre_ping=True)


async def ping() -> bool:
    try:
        async with engine().connect() as c:
            await c.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def _row(r: Any) -> dict[str, Any]:
    return dict(r._mapping)


# ── pairs (client×module matrix, self-registration §4.1) ─────────────────────────
async def resolve_pair(tenant_domain: str, tuid: str | None, module: str) -> tuple[dict[str, Any], bool]:
    """Look up the pair; register it (default ON) on first sight. Returns (pair, is_new)."""
    async with engine().begin() as c:
        sel = (await c.execute(text("SELECT * FROM assistant_pairs WHERE tenant_domain=:t AND module=:m"),
                               {"t": tenant_domain, "m": module})).first()
        if sel is not None:
            await c.execute(text("UPDATE assistant_pairs SET last_used=now() WHERE id=:id"), {"id": sel._mapping["id"]})
            return _row(sel), False
        ins = (await c.execute(text(
            "INSERT INTO assistant_pairs (tenant_domain, tuid, module, last_used) VALUES (:t,:u,:m,now()) "
            "ON CONFLICT (tenant_domain, module) DO UPDATE SET last_used=now() RETURNING *, (xmax = 0) AS inserted"),
            {"t": tenant_domain, "u": tuid, "m": module})).first()
        row = _row(ins)
        return row, row.get("inserted") is True


async def list_pairs() -> list[dict[str, Any]]:
    async with engine().connect() as c:
        return [_row(r) for r in await c.execute(text("SELECT * FROM assistant_pairs ORDER BY first_seen DESC"))]


async def toggle_pair(tenant_domain: str, module: str, enabled: bool) -> dict[str, Any] | None:
    async with engine().begin() as c:
        r = (await c.execute(text("UPDATE assistant_pairs SET enabled=:e WHERE tenant_domain=:t AND module=:m RETURNING *"),
                             {"e": enabled, "t": tenant_domain, "m": module})).first()
        return _row(r) if r is not None else None


# ── conversation log / ratings / notifications ───────────────────────────────────
@dataclass
class ConversationRow:
    tenant_domain: str
    tuid: str | None
    user_id: str
    user_name: str | None
    user_role: str | None
    module: str
    gate: str
    question: str
    answer: str | None
    citations: list[Any]
    confidence: float | None
    tools_used: list[str]
    tokens_in: int | None
    tokens_out: int | None
    latency_ms: int
    model: str | None
    conversation_id: str | None


async def log_conversation(row: ConversationRow) -> None:
    async with engine().begin() as c:
        await c.execute(text(
            "INSERT INTO assistant_conversations (tenant_domain, tuid, user_id, user_name, user_role, module, gate, "
            "question, answer, citations, confidence, tokens_in, tokens_out, latency_ms, model, conversation_id, tools_used) "
            "VALUES (:tenant_domain,:tuid,:user_id,:user_name,:user_role,:module,:gate,:question,:answer,"
            "CAST(:citations AS jsonb),:confidence,:tokens_in,:tokens_out,:latency_ms,:model,:conversation_id,CAST(:tools_used AS jsonb))"),
            {**row.__dict__, "citations": json.dumps(row.citations or []), "tools_used": json.dumps(row.tools_used or [])})


async def conversation_count() -> int:
    async with engine().connect() as c:
        return int((await c.execute(text("SELECT count(*) FROM assistant_conversations"))).scalar_one())


async def insert_rating(conversation_id: str | None, rating: int, rated_by: str, note: str | None) -> None:
    async with engine().begin() as c:
        await c.execute(text("INSERT INTO assistant_ratings (conversation_id, rating, rated_by, note) VALUES (:c,:r,:b,:n)"),
                        {"c": conversation_id, "r": rating, "b": rated_by, "n": note})


async def insert_notification(ntype: str, payload: dict[str, Any], delivered: bool, detail: str) -> None:
    async with engine().begin() as c:
        await c.execute(text("INSERT INTO assistant_notifications (type, payload, delivered, delivery_detail) "
                             "VALUES (:t, CAST(:p AS jsonb), :d, :x)"),
                        {"t": ntype, "p": json.dumps(payload), "d": delivered, "x": detail})


async def list_notifications(limit: int = 50) -> list[dict[str, Any]]:
    async with engine().connect() as c:
        return [_row(r) for r in await c.execute(text("SELECT * FROM assistant_notifications ORDER BY ts DESC LIMIT :n"), {"n": limit})]


# ── knowledge chunks (pgvector) ──────────────────────────────────────────────────
@dataclass
class Hit:
    meta: dict[str, Any]
    text: str
    distance: float   # SQUARED L2 — the Chroma semantics SIM_FLOOR/ROUTE_MARGIN were calibrated on
    module: str


async def chunk_count() -> int:
    async with engine().connect() as c:
        return int((await c.execute(text("SELECT count(*) FROM assistant_chunks"))).scalar_one())


async def search_chunks(embedding: list[float], top_k: int) -> list[Hit]:
    """Nearest chunks by squared L2 (= Chroma 'l2' space). OpenAI embeddings are unit
    vectors, so (a <-> b)^2 == 2 * cosine_distance; kept squared so the calibrated
    thresholds carry over unchanged. 907 rows: a sequential scan is sub-millisecond,
    no ANN index needed (pgvector HNSW caps `vector` at 2000 dims anyway; halfvec
    indexing is the option if the corpus ever grows large)."""
    q = "[" + ",".join(f"{x:.8f}" for x in embedding) + "]"
    async with engine().connect() as c:
        rows = await c.execute(text(
            "SELECT module, file, section_title, breadcrumb, metadata, content, "
            "power(embedding <-> CAST(:q AS vector), 2) AS distance "
            "FROM assistant_chunks ORDER BY embedding <-> CAST(:q AS vector) LIMIT :k"), {"q": q, "k": top_k})
        out: list[Hit] = []
        for r in rows:
            m = dict(r._mapping)
            meta = dict(m.get("metadata") or {})
            meta.setdefault("file", m.get("file"))
            meta.setdefault("breadcrumb", m.get("breadcrumb"))
            meta.setdefault("section_title", m.get("section_title"))
            meta.setdefault("module", m.get("module"))
            out.append(Hit(meta=meta, text=m.get("content") or "", distance=float(m["distance"]), module=str(m.get("module") or "unknown").lower()))
        return out


# ── rate limit (Postgres sliding window, multi-instance safe) ────────────────────
async def rate_check(user_id: str, window_ms: int, max_hits: int) -> bool:
    """Exactly MAX allowed per sliding window per user, even under a concurrent burst:
    a per-user advisory transaction lock serialises the count+insert."""
    if max_hits <= 0:
        return True
    window_s = window_ms / 1000.0
    async with engine().begin() as c:
        await c.execute(text("SELECT pg_advisory_xact_lock(hashtext(:u))"), {"u": user_id})
        await c.execute(text("DELETE FROM assistant_rate_hits WHERE user_id=:u AND ts < clock_timestamp() - make_interval(secs => :w)"),
                        {"u": user_id, "w": window_s})
        n = int((await c.execute(text("SELECT count(*) FROM assistant_rate_hits WHERE user_id=:u"), {"u": user_id})).scalar_one())
        if n >= max_hits:
            return False
        await c.execute(text("INSERT INTO assistant_rate_hits (user_id, ts) VALUES (:u, clock_timestamp())"), {"u": user_id})
        return True
