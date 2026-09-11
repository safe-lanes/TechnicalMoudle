"""
Compare two index sets, measured — not by impression.

  DATABASE_URL=... IDENTITY_SIGNING_KEY=... python indexer/compare_sets.py \
      --a migrated --b py-llamaparse --service-a http://127.0.0.1:8015 --service-b http://127.0.0.1:8017

Part 1 (DB): per-document chunk counts, <100-char chunks, avg length, pages — side by side.
Part 2 (retrieval): the 18 smoke-suite queries in routeOnly mode against a service instance
serving each set — routed module, top manual, confidence margin, top distance — side by side,
with the expected module/manual so a regression is visible per query.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

import asyncpg
import httpx2 as httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.identity import sign_identity  # noqa: E402

SMOKE = [
    ("how do I create a work order", "Technical", "PMS User Manual"),
    ("how to upload data in bulk data import", "Technical", "PMS User Manual"),
    ("why did the running hours not go down after my correction", "Technical", "Recent Updates"),
    ("how do I raise a defect on equipment", "Technical", "Defects"),
    ("how do vessels sync their data with the office", "Technical", "Sync"),
    ("how do I share an audit with the fleet from the office", "Audit", "Fleet Sharing"),
    ("how do I prepare for an upcoming audit", "Audit", "Preparation"),
    ("where can I see the history of past audits", "Audit", "History"),
    ("how do I create an MOC", "Safety", "MOC"),
    ("how do I carry out a risk assessment on the vessel", "Safety", "Risk Assessment"),
    ("how do I record a safety meeting", "Safety", "Safety Meeting"),
    ("how does the master review the safety management system", "Safety", "Master Review"),
    ("how do I report a near miss", "Incident", "Near Miss"),
    ("how do I report an incident on board", "Incident", "Incident User Manual"),
    ("how do I raise a lesson learnt", "Incident", "Lesson Learnt"),
    ("how do fleet notifications reach the vessel", "Incident", "Fleet Notification"),
    ("how do I plan a crew change", "Crewing", "Crewing User Manual"),
    ("how do I add a new crew member to a vessel", "Crewing", "Crewing User Manual"),
]
OFF_TOPIC = ["what is the weather in Singapore today", "how do I change my payroll bank account"]


async def db_part(a: str, b: str) -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://"))
    try:
        rows = await conn.fetch(
            "SELECT file, index_set, count(*) AS chunks, sum(case when length(content)<100 then 1 else 0 end) AS short, "
            "round(avg(length(content))) AS avg_len, max(case when page_number ~ '^[0-9]+$' then page_number::int end) AS pages "
            "FROM assistant_chunks WHERE index_set = ANY($1::text[]) GROUP BY file, index_set ORDER BY file", [a, b])
    finally:
        await conn.close()
    by: dict[str, dict[str, dict]] = {}
    for r in rows:
        by.setdefault(r["file"], {})[r["index_set"]] = dict(r)
    print(f"\n== Part 1: documents — {a} | {b}  (chunks / <100-char / avg len / pages)")
    ta = tb = sa = sb = 0
    for f in sorted(by):
        ra, rb = by[f].get(a), by[f].get(b)
        fa = f"{ra['chunks']:>4} / {ra['short']:>2} / {int(ra['avg_len']):>4} / {ra['pages'] or '-':>3}" if ra else "   (missing)"
        fb = f"{rb['chunks']:>4} / {rb['short']:>2} / {int(rb['avg_len']):>4} / {rb['pages'] or '-':>3}" if rb else "   (missing)"
        delta = f"{(rb['chunks'] - ra['chunks']):+d}" if ra and rb else ""
        print(f"  {f[:62]:<62} {fa}   |  {fb}  {delta}")
        if ra:
            ta += ra["chunks"]
            sa += ra["short"]
        if rb:
            tb += rb["chunks"]
            sb += rb["short"]
    print(f"  {'TOTAL':<62} {ta:>4} / {sa:>2}                 |  {tb:>4} / {sb:>2}")


async def ask(client: httpx.AsyncClient, base: str, key: str, q: str) -> dict:
    tok = sign_identity({"userId": "compare", "userName": "Compare", "role": "Sail Admin", "tenantDomain": "smoke-suite-tenant"}, key, 60)
    r = await client.post(f"{base}/chat", headers={"x-assistant-identity": tok}, json={"message": q, "routeOnly": True, "context": {"module": "technical"}})
    return r.json()


def _fmt(j: dict, em: str, eman: str) -> tuple[str, bool]:
    mod = j.get("module") or j.get("gate")
    top = (j.get("citations") or [{}])[0] if j.get("citations") else {}
    man, dist = top.get("manual", "-"), top.get("distance", "-")
    good = j.get("gate") == "answer" and mod == em and eman in man
    return f"{'✓' if mod == em else '✗'}{'✓' if eman in man else '✗'} m={j.get('confidence', '-')} d={dist}", good


async def retrieval_part(a: str, b: str, sa: str, sb: str) -> None:
    key = os.environ["IDENTITY_SIGNING_KEY"]
    print(f"\n== Part 2: retrieval — {a} ({sa}) | {b} ({sb})   [module ✓/✗, manual ✓/✗, margin, top-distance]")
    ok_a = ok_b = 0
    async with httpx.AsyncClient(timeout=60.0) as c:
        for q, em, eman in SMOKE:
            ja, jb = await asyncio.gather(ask(c, sa, key, q), ask(c, sb, key, q))
            fa, ga = _fmt(ja, em, eman)
            fb, gb = _fmt(jb, em, eman)
            ok_a += ga
            ok_b += gb
            print(f"  {q[:50]:<50} {fa:<34} | {fb}")
        for q in OFF_TOPIC:
            ja, jb = await asyncio.gather(ask(c, sa, key, q), ask(c, sb, key, q))
            print(f"  {q[:50]:<50} gate={ja.get('gate'):<26} | gate={jb.get('gate')}")
    print(f"\n  routing+manual correct: {a} {ok_a}/{len(SMOKE)}   {b} {ok_b}/{len(SMOKE)}")


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", default="migrated")
    ap.add_argument("--b", required=True)
    ap.add_argument("--service-a", default=None)
    ap.add_argument("--service-b", default=None)
    args = ap.parse_args()
    await db_part(args.a, args.b)
    if args.service_a and args.service_b:
        await retrieval_part(args.a, args.b, args.service_a, args.service_b)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
