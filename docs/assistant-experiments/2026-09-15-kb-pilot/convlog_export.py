# One-off: export the assistant's own conversation-log rows written today from 15:00 UTC (the step-4 candidate runs) so that
# actual token counts and latencies can be attributed to each candidate by joining on the answer text of the suite dumps.
import asyncio
import json
import sys

sys.path.insert(0, "/app")
from sqlalchemy import text  # noqa: E402

from app.db import engine  # noqa: E402


async def m():
    async with engine().connect() as c:
        r = await c.execute(text("SELECT ts, gate, module, model, tokens_in, tokens_out, latency_ms, question, answer "
                                 "FROM assistant_conversations WHERE ts >= TIMESTAMPTZ '2026-09-15 15:00:00+00' ORDER BY ts"))
        n = 0
        with open("/out/convlog-s4.jsonl", "w", encoding="utf-8") as f:
            for row in r:
                d = dict(row._mapping)
                d["ts"] = d["ts"].isoformat()
                f.write(json.dumps(d, ensure_ascii=False) + "\n")
                n += 1
        print("rows", n)


asyncio.run(m())
