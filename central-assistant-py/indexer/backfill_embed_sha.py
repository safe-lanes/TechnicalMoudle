"""
Backfill `embed_sha` / `embed_model` into chunk metadata for index sets built BEFORE vector
reuse existed (owner rule 14-Sep-2026: reuse stored vectors when the embedding input is
unchanged). Additive metadata only — content and vectors are never touched.

The sha is computed over the embedding input our indexer would produce for the chunk
(EMBED_INPUT_VERSION metadata+text, or text only) and the model recorded in assistant_documents.
For the `migrated` set (embedded by LlamaIndex) that input is the PROVEN metadata+text form, so a
later rebuild that yields the identical chunk reuses the live vector verbatim.

  DATABASE_URL=... python indexer/backfill_embed_sha.py --index-set migrated [--embed-input meta] [--dry-run]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import asyncpg

sys.path.insert(0, str(Path(__file__).resolve().parent))
from index_documents import EMBED_META_KEYS, EMBED_MODEL_DEFAULT, embed_sha  # noqa: E402


def input_for(meta: dict, content: str, mode: str) -> str:
    if mode == "text":
        return content
    md = "\n".join(f"{k}: {meta[k]}" for k in EMBED_META_KEYS if k in meta)
    return f"{md}\n\n{content}"


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index-set", required=True)
    ap.add_argument("--embed-input", choices=["meta", "text"], default="meta")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--overwrite", action="store_true", help="recompute even where embed_sha already exists")
    a = ap.parse_args()
    conn = await asyncpg.connect(os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://"))
    try:
        models = {r["file"]: r["embed_model"] for r in await conn.fetch("SELECT file, embed_model FROM assistant_documents WHERE index_set=$1", a.index_set)}
        rows = await conn.fetch("SELECT id, file, content, metadata FROM assistant_chunks WHERE index_set=$1", a.index_set)
        done = skipped = 0
        for r in rows:
            meta = json.loads(r["metadata"]) if isinstance(r["metadata"], str) else dict(r["metadata"] or {})
            if meta.get("embed_sha") and not a.overwrite:
                skipped += 1
                continue
            model = models.get(r["file"]) or EMBED_MODEL_DEFAULT
            meta["embed_sha"] = embed_sha(input_for(meta, r["content"], a.embed_input), model)
            meta["embed_model"] = model
            if not a.dry_run:
                await conn.execute("UPDATE assistant_chunks SET metadata=$1::jsonb WHERE index_set=$2 AND id=$3", json.dumps(meta), a.index_set, r["id"])
            done += 1
        print(f"index set '{a.index_set}': {done} chunks {'would be ' if a.dry_run else ''}stamped, {skipped} already had embed_sha, {len(rows)} total")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
