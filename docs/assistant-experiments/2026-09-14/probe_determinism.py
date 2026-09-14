"""Is the embedding provider deterministic for a byte-identical input? Embeds 3 live chunks' inputs
twice now, and compares (a) call-1 vs call-2, (b) call-1 vs the vector stored in `migrated`
(LlamaIndex, Jul/Sep) and (c) vs the vector stored in `ag-base` (our indexer, 14-Sep, same input)."""
import asyncio
import json
import math
import os
import sys

import asyncpg
from openai import OpenAI

sys.path.insert(0, "/app/indexer")
from index_documents import EMBED_META_KEYS  # noqa: E402


def cos(a, b):
    return sum(x * y for x, y in zip(a, b, strict=True)) / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))


def vec(t):
    return [float(x) for x in t.strip("[]").split(",")]


async def main():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://"))
    rows = await conn.fetch("SELECT m.id, m.content, m.metadata, m.embedding::text AS mv, a.embedding::text AS av FROM assistant_chunks m "
                            "JOIN assistant_chunks a ON a.index_set='ag-base' AND a.id=m.id WHERE m.index_set='migrated' ORDER BY m.id LIMIT 3")
    await conn.close()
    oai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    model = os.environ.get("EMBED_MODEL", "text-embedding-3-large")
    for r in rows:
        meta = json.loads(r["metadata"]) if isinstance(r["metadata"], str) else dict(r["metadata"])
        inp = "\n".join(f"{k}: {meta[k]}" for k in EMBED_META_KEYS if k in meta) + "\n\n" + r["content"]
        e1 = oai.embeddings.create(model=model, input=[inp]).data[0].embedding
        e2 = oai.embeddings.create(model=model, input=[inp]).data[0].embedding
        print(f"{r['id'][:40]:<40} dims={len(e1)} now-vs-now={cos(e1, e2):.6f} now-vs-migrated={cos(e1, vec(r['mv'])):.6f} now-vs-ag-base(14-Sep)={cos(e1, vec(r['av'])):.6f} migrated-vs-ag-base={cos(vec(r['mv']), vec(r['av'])):.6f}")


asyncio.run(main())
