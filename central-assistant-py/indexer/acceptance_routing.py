"""
Routing / intent cases (owner brief 15-Sep-2026, step 4) — measured with routeOnly=true (embedding only, no answer model),
so routing and excerpt-selection changes can be compared cheaply and separately from answer generation.

Each case: question, the originating-module context to send (or null = no context), the expected gate/module, and the
excerpt that must (or must not) be among the selected excerpts (file substring). Cases cover: a general creation question
(must reach the overview AND keep the unplanned procedure), an explicitly named method (must keep that procedure), the pump
phrasing (must not be unplanned-only), frozen case 05 with / without / with a conflicting explicit module, and the guard
that module context never overrides an explicit module name.

  python indexer/acceptance_routing.py --set C=http://... --set D1=http://... [--dump out.jsonl]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx2 as httpx  # noqa: E402

from app.identity import sign_identity  # noqa: E402

ROUTING_SUITE_VERSION = "2026-09-15.2"  # .2: must/must_not substrings match "manual — section", not the file name alone
# (id, question, context module or None, expected gate, expected module label or None, must-include excerpt substrings, must-exclude substrings)
CASES = [
    ("rt-general-01", "How do I create a work order?", "technical", "answer", "Technical", ["How work orders are created", "HOW TO CREATE AN UNPLANNED WORK ORDER"], []),
    ("rt-general-02", "How to create work order in PMS?", "technical", "answer", "Technical", ["How work orders are created"], []),
    ("rt-general-03", "Steps to create a new work order", "technical", "answer", "Technical", ["How work orders are created"], []),
    ("rt-named-01", "How do I create an unplanned work order?", "technical", "answer", "Technical", ["HOW TO CREATE AN UNPLANNED WORK ORDER"], []),
    ("rt-named-02", "How does Generate Now work in the office?", "technical", "answer", "Technical", ["Generate Now"], []),
    ("rt-named-03", "How do I generate a work order for one job from Components?", "technical", "answer", "Technical", ["Generate WO"], []),
    ("rt-pump-01", "I need to raise a work order for a pump — how do I do that?", "technical", "answer", "Technical", ["How work orders are created"], []),
    ("rt-05-ctx-technical", "What are the hazard categories in a risk assessment?", "technical", "answer", "Safety", ["Risk Assessment"], []),
    ("rt-05-no-ctx", "What are the hazard categories in a risk assessment?", None, "answer", "Safety", ["Risk Assessment"], []),
    ("rt-05-ctx-safety", "What are the hazard categories in a risk assessment?", "safety", "answer", "Safety", ["Risk Assessment"], []),
    ("rt-05-explicit-conflict", "In the Incident module, what are the hazard categories in a risk assessment?", "technical", None, "Incident", [], []),
    ("rt-ctx-no-override", "How do I report a near miss?", "technical", "answer", "Incident", ["Near Miss"], []),
    ("rt-explicit-module", "In the Safety module, how do I record a safety meeting?", "technical", "answer", "Safety", ["Safety Meeting"], []),
]
_n = 0


async def probe(client: httpx.AsyncClient, base: str, key: str, q: str, module: str | None) -> dict:
    global _n
    _n += 1
    tok = sign_identity({"userId": f"route-{_n}", "userName": "Acceptance", "role": "Sail Admin", "tenantDomain": "smoke-suite-tenant"}, key, 60)
    body: dict = {"message": q, "routeOnly": True}
    if module:
        body["context"] = {"module": module}
    r = await client.post(f"{base}/chat", headers={"x-assistant-identity": tok}, json=body)
    return r.json()


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True)
    ap.add_argument("--dump", default=None)
    args = ap.parse_args()
    key = os.environ["IDENTITY_SIGNING_KEY"]
    sets = [(s.partition("=")[0], s.partition("=")[2]) for s in args.set]
    dump = open(args.dump, "w", encoding="utf-8") if args.dump else None  # noqa: SIM115
    score = {n: 0 for n, _ in sets}
    print(f"routing suite {ROUTING_SUITE_VERSION} · {len(CASES)} cases · routeOnly (no answer model)")
    async with httpx.AsyncClient(timeout=60.0) as c:
        for cid, q, ctx, exp_gate, exp_mod, must, must_not in CASES:
            print(f"\n[{cid}] {q}  (context={ctx})")
            for n, u in sets:
                r = await probe(c, u, key, q, ctx)
                gate, mod = r.get("gate"), r.get("module")
                files = [f"{ci.get('manual', '')} — {ci.get('section', '')}" for ci in r.get("citations", [])]  # manual AND section (a section name is not in the file name)
                ok_gate = exp_gate is None or gate == exp_gate
                ok_mod = exp_mod is None or mod == exp_mod or (gate == "clarify" and exp_mod in (r.get("candidates") or []))
                ok_inc = all(any(m in f for f in files) for m in must)
                ok_exc = not any(any(m in f for f in files) for m in must_not)
                ok = ok_gate and ok_mod and ok_inc and ok_exc
                score[n] += ok
                if dump:
                    dump.write(json.dumps({"suite": "routing", "case": cid, "set": n, "ok": ok, "response": r}, ensure_ascii=False) + "\n")
                print(f"   {n:<10} {'✓' if ok else '✗'} gate={gate} module={mod} conf={r.get('confidence')} routing={r.get('routing', '-')} | " + " | ".join(f[:34] for f in files[:5]) + ("" if ok_inc else f"  MISSING {must}"))
    print("\n== totals ==")
    for n, _ in sets:
        print(f"   {n:<10} {score[n]}/{len(CASES)}")
    if dump:
        dump.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
