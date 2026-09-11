"""
One-shot: move every chunk (text + 3072-d embedding + metadata) from the Chroma server
into assistant_chunks (pgvector). No re-parse, no re-embed, zero OpenAI spend.

  CHROMA_URL=http://127.0.0.1:8111 DATABASE_URL=postgres://assistant:...@127.0.0.1:5434/assistant \
    python indexer/migrate_chroma_to_pgvector.py [--collection technical_docs] [--batch 100]

Idempotent: ON CONFLICT (id) DO UPDATE. Prints source count, inserted count, and a
per-module tally so the 907 = 907 proof is in the output.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from collections import Counter
from typing import Any

import asyncpg
import httpx2 as httpx

CHROMA_URL = os.environ.get("CHROMA_URL", "http://127.0.0.1:8111")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
BASE = f"{CHROMA_URL}/api/v2/tenants/default_tenant/databases/default_database/collections"


async def chroma_collection_id(client: httpx.AsyncClient, name: str) -> str:
    r = await client.get(BASE)
    r.raise_for_status()
    for c in r.json():
        if c["name"] == name:
            return c["id"]
    raise SystemExit(f"collection {name!r} not found in Chroma")


async def chroma_count(client: httpx.AsyncClient, cid: str) -> int:
    r = await client.get(f"{BASE}/{cid}/count")
    r.raise_for_status()
    return int(r.json())


async def chroma_page(client: httpx.AsyncClient, cid: str, offset: int, limit: int) -> dict[str, Any]:
    r = await client.post(f"{BASE}/{cid}/get", json={"limit": limit, "offset": offset, "include": ["metadatas", "documents", "embeddings"]})
    r.raise_for_status()
    return r.json()


def _int_or_none(v: Any) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--collection", default="technical_docs")
    ap.add_argument("--batch", type=int, default=100)
    args = ap.parse_args()
    if not DATABASE_URL:
        print("DATABASE_URL required", file=sys.stderr)
        return 2

    async with httpx.AsyncClient(timeout=60.0) as client:
        cid = await chroma_collection_id(client, args.collection)
        total = await chroma_count(client, cid)
        print(f"chroma {args.collection} ({cid}): {total} chunks")
        conn = await asyncpg.connect(DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))
        try:
            before = await conn.fetchval("SELECT count(*) FROM assistant_chunks")
            written = 0
            tally: Counter[str] = Counter()
            offset = 0
            while offset < total:
                page = await chroma_page(client, cid, offset, args.batch)
                ids, metas, docs, embs = page["ids"], page["metadatas"], page["documents"], page["embeddings"]
                rows = []
                for i, cid_ in enumerate(ids):
                    meta = dict(metas[i] or {})
                    meta.pop("_node_content", None)  # LlamaIndex serialised node — bulky, redundant with content
                    module = str(meta.get("module") or "unknown").lower()
                    tally[module] += 1
                    emb = "[" + ",".join(repr(float(x)) for x in embs[i]) + "]"
                    rows.append((cid_, module, meta.get("file"), meta.get("section_title"), meta.get("breadcrumb"),
                                 str(meta.get("page_number")) if meta.get("page_number") is not None else None,
                                 _int_or_none(meta.get("chunk_index")), docs[i] or "", json.dumps(meta), emb))
                await conn.executemany(
                    "INSERT INTO assistant_chunks (id, module, file, section_title, breadcrumb, page_number, chunk_index, content, metadata, embedding) "
                    "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::vector) "
                    "ON CONFLICT (id) DO UPDATE SET module=EXCLUDED.module, file=EXCLUDED.file, section_title=EXCLUDED.section_title, "
                    "breadcrumb=EXCLUDED.breadcrumb, page_number=EXCLUDED.page_number, chunk_index=EXCLUDED.chunk_index, "
                    "content=EXCLUDED.content, metadata=EXCLUDED.metadata, embedding=EXCLUDED.embedding, indexed_at=now()",
                    rows)
                written += len(rows)
                offset += len(ids)
                print(f"  {written}/{total}")
                if not ids:
                    break
            after = await conn.fetchval("SELECT count(*) FROM assistant_chunks")
            dims = await conn.fetchval("SELECT vector_dims(embedding) FROM assistant_chunks LIMIT 1")
            print(f"pgvector assistant_chunks: before={before} written={written} after={after} dims={dims}")
            print("per module:", dict(sorted(tally.items())))
            ok = after == total
            print("PROOF:", "OK — counts match" if ok else "MISMATCH")
            return 0 if ok else 1
        finally:
            await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
