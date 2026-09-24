"""
Which embedding INPUT reproduces the live set's stored vectors? The original indexer used
LlamaIndex, whose nodes embed "{key}: {value}\n…\n\n{text}" (metadata prepended) by default;
the Python indexer embeds the chunk text only. Cosine of freshly computed variants against
the stored vector tells us which is right.

  DATABASE_URL=... OPENAI_API_KEY=... python indexer/probe_embed_input.py
"""
from __future__ import annotations

import asyncio
import json
import math
import os

import asyncpg
from openai import OpenAI

ORDER = ["file", "slug_url", "breadcrumb", "section_title", "source_type", "chunk_index", "page_number", "llamaparse_tier", "llamaparse_version"]


def cos(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True)) / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))


async def main() -> None:
    oai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    conn = await asyncpg.connect(os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://"))
    rows = await conn.fetch(
        "select file, content, metadata, embedding::text as emb from assistant_chunks where index_set='migrated' "
        "and file in ($1,$2,$3) and chunk_index in (0, 5) order by file, chunk_index",
        "Audit - Preparation Manual_Office_R1_30.06.2026.pdf", "Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf",
        "Crewing - Crewing User Manual R2_10.06.2026.pdf")
    await conn.close()
    for r in rows[:5]:
        stored = json.loads(r["emb"])
        meta = json.loads(r["metadata"]) if isinstance(r["metadata"], str) else dict(r["metadata"])
        md = "\n".join(f"{k}: {meta[k]}" for k in ORDER if k in meta)
        md_sorted = "\n".join(f"{k}: {meta[k]}" for k in sorted(k for k in ORDER if k in meta))
        md_no_lp = "\n".join(f"{k}: {meta[k]}" for k in ORDER[:7] if k in meta)
        variants = {
            "text only": r["content"],
            "llamaindex metadata(9)+text": md + "\n\n" + r["content"],
            "metadata(9) sorted keys+text": md_sorted + "\n\n" + r["content"],
            "metadata(7, no llamaparse)+text": md_no_lp + "\n\n" + r["content"],
            "metadata(9)+single newline+text": md + "\n" + r["content"],
            "metadata(9)+module+text": md + f"\nmodule: {meta.get('module')}\n\n" + r["content"],
        }
        embs = oai.embeddings.create(model="text-embedding-3-large", input=list(variants.values())).data
        print(f"{r['file'][:42]} | chunk {meta.get('chunk_index')} p{meta.get('page_number')} | cosine to STORED:")
        for (name, _), e in zip(variants.items(), embs, strict=True):
            print(f"    {name:<30} {cos(stored, e.embedding):.5f}")


if __name__ == "__main__":
    asyncio.run(main())
