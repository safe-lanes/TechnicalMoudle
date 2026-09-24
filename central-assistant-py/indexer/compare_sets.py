"""
Compare index sets, measured — not by impression. Any number of sets.

  DATABASE_URL=... IDENTITY_SIGNING_KEY=... python indexer/compare_sets.py \
      --set migrated=http://127.0.0.1:8015 --set py-llamaparse=http://127.0.0.1:8017 --set ce-clean=http://127.0.0.1:8018

Part 1 (DB): per-document chunk counts, <100-char chunks, avg length, inline-HTML-tagged
chunks — side by side per set.
Part 2 (retrieval): the 18 smoke-suite queries in routeOnly mode against a service instance
per set — routed module, top manual, confidence margin, top distance — with the expected
module/manual so a regression is visible per query. Unique user per request (the per-user
limiter would otherwise clip the run).
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

# Retrieval-suite expectation versions (owner rule 14-Sep-2026: version and document corrections; keep the original
# result alongside the revised one; do not change unrelated expectations).
#   1 (original, 11-Sep): every query expects the official manual as the top source.
#   2 (14-Sep, follow-up 1): "how do I create a work order" ALSO accepts the code-derived "Recent Updates" note
#     (§1.1.14.13, implementation-specific, revision recorded in generated-docs/PROVENANCE.md) as the top source.
#     Nothing else changes. Both versions are run and reported.
EXPECT_VERSIONS = {1: {}, 2: {"how do I create a work order": ("PMS User Manual", "Recent Updates")}}
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


async def db_part(sets: list[str]) -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://"))
    try:
        rows = await conn.fetch(
            "SELECT file, index_set, count(*) AS chunks, sum(case when length(content)<100 then 1 else 0 end) AS short, "
            "round(avg(length(content))) AS avg_len, sum(case when content ~ '<[a-zA-Z/][^>]*>' then 1 else 0 end) AS html "
            "FROM assistant_chunks WHERE index_set = ANY($1::text[]) GROUP BY file, index_set ORDER BY file", sets)
    finally:
        await conn.close()
    by: dict[str, dict[str, dict]] = {}
    for r in rows:
        by.setdefault(r["file"], {})[r["index_set"]] = dict(r)
    w = 34
    print("\n== Part 1: documents — per set: chunks / <100-char / avg len / html-tagged chunks")
    print(f"  {'manual':<{w}} " + " | ".join(f"{s[:26]:^26}" for s in sets))
    tot = {s: [0, 0, 0] for s in sets}
    for f in sorted(by):
        cells = []
        for s in sets:
            r = by[f].get(s)
            if r:
                cells.append(f"{r['chunks']:>4} / {r['short']:>2} / {int(r['avg_len']):>4} / {r['html']:>3}")
                tot[s][0] += r["chunks"]
                tot[s][1] += r["short"]
                tot[s][2] += r["html"]
            else:
                cells.append(f"{'(missing)':^26}")
        print(f"  {f[:w]:<{w}} " + " | ".join(f"{c:^26}" for c in cells))
    print(f"  {'TOTAL':<{w}} " + " | ".join(f"{t[0]:>4} / {t[1]:>2} /      / {t[2]:>3}".center(26) for t in tot.values()))


_n = 0


async def ask(client: httpx.AsyncClient, base: str, key: str, q: str) -> dict:
    global _n
    _n += 1
    tok = sign_identity({"userId": f"compare-{_n}", "userName": "Compare", "role": "Sail Admin", "tenantDomain": "smoke-suite-tenant"}, key, 60)
    r = await client.post(f"{base}/chat", headers={"x-assistant-identity": tok}, json={"message": q, "routeOnly": True, "context": {"module": "technical"}})
    return r.json()


def _fmt(j: dict, em: str, eman: str | tuple[str, ...]) -> tuple[str, bool]:
    eman = tuple(eman) if isinstance(eman, tuple) else (eman,)
    mod = j.get("module") or j.get("gate")
    top = (j.get("citations") or [{}])[0] if j.get("citations") else {}
    man, dist = top.get("manual", "-"), top.get("distance", "-")
    man_ok = any(e in man for e in eman)
    good = j.get("gate") == "answer" and mod == em and man_ok
    conf = j.get("confidence", "-")
    conf = f"{conf:.3f}" if isinstance(conf, float) else conf
    extra = f" clarify:{'/'.join(j.get('candidates', []))}" if j.get("gate") == "clarify" else ""
    return f"{'✓' if mod == em else '✗'}{'✓' if man_ok else '✗'} m={conf} d={dist}{extra}", good


async def retrieval_part(sets: list[str], services: list[str], expect_version: int = 1) -> None:
    key = os.environ["IDENTITY_SIGNING_KEY"]
    alt = EXPECT_VERSIONS[expect_version]
    print("\n== Part 2: retrieval — " + " | ".join(f"{s} ({u})" for s, u in zip(sets, services, strict=True)) + f"   [module ✓/✗, manual ✓/✗, margin, top-distance]  expectations v{expect_version}")
    ok = {s: 0 for s in sets}
    ok_alt = {s: 0 for s in sets}  # the other expectation version, computed from the same responses (both are always reported)
    other = EXPECT_VERSIONS[2 if expect_version == 1 else 1]
    async with httpx.AsyncClient(timeout=60.0) as c:
        for q, em, eman in SMOKE:
            res = await asyncio.gather(*(ask(c, u, key, q) for u in services))
            cells = []
            for s, j in zip(sets, res, strict=True):
                f, g = _fmt(j, em, alt.get(q, eman))
                _, g_other = _fmt(j, em, other.get(q, eman))
                ok[s] += g
                ok_alt[s] += g_other
                cells.append(f)
            print(f"  {q[:44]:<44} " + " | ".join(f"{x:<30}" for x in cells))
        for q in OFF_TOPIC:
            res = await asyncio.gather(*(ask(c, u, key, q) for u in services))
            print(f"  {q[:44]:<44} " + " | ".join(f"{'gate=' + str(j.get('gate')):<30}" for j in res))
    print(f"\n  routing+manual correct (expectations v{expect_version}): " + "   ".join(f"{s} {ok[s]}/{len(SMOKE)}" for s in sets))
    print(f"  routing+manual correct (expectations v{2 if expect_version == 1 else 1}, same responses): " + "   ".join(f"{s} {ok_alt[s]}/{len(SMOKE)}" for s in sets))


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True, help="NAME=SERVICE_URL (repeatable); URL optional for DB-only")
    ap.add_argument("--expect-version", type=int, choices=sorted(EXPECT_VERSIONS), default=1, help="retrieval expectation version (1 = original; 2 = accepts the code-derived note for the work-order query); the other version is always reported too")
    args = ap.parse_args()
    sets, services = [], []
    for spec in args.set:
        name, _, url = spec.partition("=")
        sets.append(name)
        services.append(url)
    await db_part(sets)
    if all(services):
        await retrieval_part(sets, services, args.expect_version)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
