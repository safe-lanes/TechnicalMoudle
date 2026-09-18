"""
Fresh validation suite (owner brief 18-Sep-2026, item 3) — 10 source-backed questions frozen BEFORE any fix was tested,
held out of tuning. Cases live in fresh_cases.json with a per-case `score_by` rubric; the automatic score here is a floor
and every run is dumped in full so the rubric can be applied by reading.

Automatic scoring per run:
  answer    all `must` phrases present (markdown-normalised) and no `must_not` phrase outside a negation
  module    when the case names `expected_module`, the answering module must match it (module-context cases)
  citation  the expected manual (and page, when the case gives pages) appears among the citations shown to the user

  IDENTITY_SIGNING_KEY=... python indexer/acceptance_fresh.py --repeat 3 --set D5=http://host:8000 --dump out.jsonl
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import httpx2 as httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).parent))
from acceptance_answers import md_plain, negated, page_of  # noqa: E402
from app.identity import sign_identity  # noqa: E402

_n = 0


async def ask(client: httpx.AsyncClient, base: str, key: str, q: str, module: str | None) -> dict:
    global _n
    _n += 1
    tok = sign_identity({"userId": f"fresh-{_n}", "userName": "Acceptance", "role": "Sail Admin", "tenantDomain": "smoke-suite-tenant"}, key, 60)
    body: dict = {"message": q}
    if module:
        body["context"] = {"module": module}
    r = await client.post(f"{base}/chat", headers={"x-assistant-identity": tok}, json=body)
    return r.json()


def judge(case: dict, resp: dict) -> tuple[bool, bool, bool, str]:
    ans = md_plain(resp.get("response") or "").lower()
    must = [m for m in case["must"] if m.lower() not in ans]
    forbidden = [p for p in case["must_not"] if p.lower() in ans and not negated(ans, p)]
    ok_answer = not must and not forbidden and resp.get("gate") == "answer"
    exp_mod = case.get("expected_module")
    ok_module = True
    if exp_mod and " or " not in exp_mod:          # "Safety or a clarification" is judged by reading
        ok_module = str(resp.get("module") or "").lower() == exp_mod.lower()
    cits = resp.get("citations") or []
    if case.get("pages"):
        stem = case["file"].rsplit(".", 1)[0]
        ok_cite = any(stem.lower()[:40] in str(c.get("manual", "")).lower() and page_of(c) in case["pages"] for c in cits)
    else:
        ok_cite = bool(cits)
    detail = f"gate={resp.get('gate')} module={resp.get('module')} missing={must} forbidden={forbidden}"
    return ok_answer, ok_module, ok_cite, detail


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True)
    ap.add_argument("--repeat", type=int, default=1)
    ap.add_argument("--dump", default=None)
    ap.add_argument("--cases", default=str(Path(__file__).with_name("fresh_cases.json")))
    args = ap.parse_args()
    key = os.environ["IDENTITY_SIGNING_KEY"]
    sets = [(s.partition("=")[0], s.partition("=")[2]) for s in args.set]
    spec = json.loads(Path(args.cases).read_text(encoding="utf-8"))
    cases = spec["cases"]
    dump = open(args.dump, "w", encoding="utf-8") if args.dump else None  # noqa: SIM115
    score = {n: 0 for n, _ in sets}
    print(f"fresh validation suite {spec['version']} · {len(cases)} cases · repeat={args.repeat} (frozen: {spec['frozen'][:60]}…)")
    async with httpx.AsyncClient(timeout=180.0) as c:
        for case in cases:
            print(f"\n[{case['id']} {case['kind']}] {case['question']}")
            runs = [await asyncio.gather(*(ask(c, u, key, case["question"], case.get("module")) for _, u in sets)) for _ in range(args.repeat)]
            for si, (n, _) in enumerate(sets):
                votes = []
                for r in range(args.repeat):
                    resp = runs[r][si]
                    a, m, ct, detail = judge(case, resp)
                    votes.append(a and m and ct)
                    if dump:
                        dump.write(json.dumps({"suite": "fresh", "case": case["id"], "kind": case["kind"], "set": n, "run": r + 1,
                                               "verdict": {"answer": a, "module": m, "citation": ct},
                                               "question": case["question"], "score_by": case["score_by"], "response": resp}, ensure_ascii=False) + "\n")
                    if r == 0:
                        print(f"   {n:<12} answer {'✓' if a else '✗'}  module {'✓' if m else '✗'}  cite {'✓' if ct else '✗'}  {detail}")
                ok_all = all(votes)
                score[n] += ok_all
                print(f"   {n:<12} PASS {'✓' if ok_all else '✗'} [{sum(votes)}/{len(votes)} — all runs required]")
    print("\n== totals (automatic floor; apply score_by by reading before concluding) ==")
    for n, _ in sets:
        print(f"   {n:<12} {score[n]}/{len(cases)}")
    if dump:
        dump.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
