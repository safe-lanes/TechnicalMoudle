"""
Work-order creation regression cases (owner item 1, 14-Sep-2026) — SEPARATE from the frozen suites.
The generic question must explain the verified alternatives without assuming "unplanned":
planned work orders are generated from the job schedule (ship daily scan; office only Sail Admin +
vessel switch), a work order can be generated for a specific job from Components (with the same
office conditions), and an unplanned work order is created with '+ Unplanned W.O'. Citations:
official PMS manual for manual-backed steps, the code-derived Recent Updates document for the
implementation details the June manuals lack.

  IDENTITY_SIGNING_KEY=... python indexer/acceptance_wo.py --repeat 3 --set base=http://127.0.0.1:8016 --set cand=http://127.0.0.1:8018
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx2 as httpx  # noqa: E402
from acceptance_answers import ask, judge  # noqa: E402

# .2 (after run E, reported): .1 was satisfied by "Sail Admin" inside the manual's FILE NAME in the Source line while the
#     answer body stated no office condition at all (3/3 runs). The judge now checks the answer BODY (text before the
#     "Source" line) and requires the office condition words there; run E's 2/2 under .1 is therefore NOT a true pass.
# .3 (owner decisions 14-Sep): PER-ACTION pairing — the block that describes 'Generate Now' must carry BOTH the Sail Admin
#     role and the vessel switch; the block that describes the per-job 'Generate WO' must carry the vessel switch and must
#     NOT attach the Sail Admin role (the code has no role check on that path); a role attached to the wrong action fails.
#     Added wo-generic-03 = the phrasing that ranked the new section 6th ("How to create work order in PMS?").
WO_SUITE_VERSION = "2026-09-14.3"
NOT_COVERED = ["not covered", "isn't covered", "not documented", "does not cover", "no information"]
# (id, question, module, expected manual substring (any Technical source), pages, must ALL, must_not, extra rule, source)
CASES = [
    ("wo-generic-01", "How do I create a work order?", "technical", "Technical", None,
     ["unplanned w.o", "generate wo"], NOT_COVERED, "three-paths",
     "PMS Office p28 §1.1.5.1 (Scheduled = jobs planned with a future due date), p18 (Components Part C 'Generate WO' with a reason), p29 §1.1.5.2 ('+ Unplanned W.O'); Recent Updates R3.2 §1.1.14.13 (ship daily scan; office = Sail Admin AND vessel switch, for Generate Now and per-job Generate WO)."),
    ("wo-generic-02", "How are planned work orders created in PMS — do I have to create them myself?", "technical", "Technical", None,
     ["job"], NOT_COVERED, "planned-auto",
     "Recent Updates R3.2 §1.1.14.13: generated from the job schedule by the ship's daily scan; office generation only by a Sail Admin with the vessel switch on."),
    ("wo-generic-03", "How to create work order in PMS?", "technical", "Technical", None,
     ["unplanned w.o", "generate wo"], NOT_COVERED, "three-paths",
     "Same expectation as wo-generic-01; this phrasing ranked the new section 6th (outside the 5 excerpts) in the rank probe of 14-Sep."),
]


def body_of(text: str) -> str:
    """The answer without its trailing Source line(s) — file names such as '…For Office_Sail Admin…' must not satisfy content checks."""
    return re.split(r"\n\s*\*{0,2}source\*{0,2}\s*:", text, flags=re.I)[0].lower()


def blocks_of(body: str) -> list[str]:
    """Split the answer body into per-action blocks: numbered/bold headings or blank-line paragraphs."""
    parts = re.split(r"\n(?=\s*(?:\d+\.\s*\*\*|\*\*|\d+\.\s+\*\*|- \*\*|#{1,4}\s)|\n\s*\n)", body)
    return [p.strip() for p in parts if p.strip()]


def block_for(body: str, keyword_re: str) -> str:
    """The block(s) that describe one action (joined), or '' if the action is not described."""
    return "\n".join(b for b in blocks_of(body) if re.search(keyword_re, b))


def check_pairing(body: str) -> tuple[bool, str]:
    """Per-action permission pairing (suite .3):
       Generate Now  → must state Sail Admin AND the vessel switch in ITS block
       Generate WO   → must state the vessel switch in ITS block and must NOT attach Sail Admin there"""
    gn = block_for(body, r"generate now")
    gw = block_for(body, r"generate wo\b|generate wo'|'generate wo|generate work order for|specific job")
    notes: list[str] = []
    if not gn:
        notes.append("Generate Now not described")
    else:
        if "sail admin" not in gn:
            notes.append("Generate Now block lacks Sail Admin")
        if "switch" not in gn:
            notes.append("Generate Now block lacks the vessel switch")
    if not gw:
        notes.append("per-job Generate WO not described")
    else:
        if "switch" not in gw:
            notes.append("Generate WO block lacks the vessel switch")
        if "sail admin" in gw and "generate now" not in gw:
            notes.append("Sail Admin wrongly attached to Generate WO")
    ok = not notes
    return ok, ("pairing ✓" if ok else "pairing ✗: " + "; ".join(notes))


def extra_rule(rule: str, text: str) -> tuple[bool, str]:
    t = body_of(text)
    if rule == "three-paths":
        auto = bool(re.search(r"(generated automatically|automatically generat|daily scan|from the job schedule|job schedule|from the job'?s schedule|scheduled work orders? (are|is) (generated|created))", t))
        pair_ok, pair_why = check_pairing(t)
        return auto and pair_ok, ("automatic generation " + ("✓" if auto else "MISSING") + "; " + pair_why)
    if rule == "planned-auto":
        auto = bool(re.search(r"(automatic|daily scan|generated (by|from)|from the job)", t))
        gn = block_for(t, r"generate now") or t
        office = ("sail admin" in gn) and ("switch" in gn)
        return auto and office, "automatic generation " + ("✓" if auto else "MISSING") + "; Generate Now conditions (Sail Admin + switch) " + ("✓" if office else "MISSING")
    return True, ""


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True)
    ap.add_argument("--repeat", type=int, default=1)
    ap.add_argument("--dump", default=None)
    args = ap.parse_args()
    key = os.environ["IDENTITY_SIGNING_KEY"]
    sets = [(s.partition("=")[0], s.partition("=")[2]) for s in args.set]
    dump = open(args.dump, "w", encoding="utf-8") if args.dump else None  # noqa: SIM115
    score = dict.fromkeys([n for n, _ in sets], 0)
    print(f"work-order suite {WO_SUITE_VERSION} · {len(CASES)} cases · repeat={args.repeat}")
    async with httpx.AsyncClient(timeout=150.0) as c:
        for cid, q, module, manual, page, must, must_not, rule, _src in CASES:
            print(f"\n[{cid}] {q}")
            runs = [await asyncio.gather(*(ask(c, u, key, q, module) for _, u in sets)) for _ in range(args.repeat)]
            for si, (n, _) in enumerate(sets):
                votes = []
                for r in range(args.repeat):
                    a, ct, _at, detail = judge(runs[r][si], manual, page, must, must_not, "gen")
                    ok_extra, why = extra_rule(rule, runs[r][si].get("response") or "")
                    votes.append(a and ct and ok_extra)
                    if dump:
                        dump.write(json.dumps({"suite": "wo", "case": cid, "set": n, "run": r + 1, "verdict": {"answer": a, "citation": ct, "rule": ok_extra, "why": why}, "response": runs[r][si]}, ensure_ascii=False) + "\n")
                    if r == 0:
                        print(f"   {n:<14} answer {'✓' if a else '✗'}  cite {'✓' if ct else '✗'}  rule {'✓' if ok_extra else '✗'} ({why})  {detail}")
                ok = sum(votes) == len(votes)  # owner rule (.3): required conditions must survive ALL runs — no majority vote here
                score[n] += ok
                print(f"   {n:<14} PASS {'✓' if ok else '✗'} [{sum(votes)}/{len(votes)} — all runs required]")
    print("\n== totals ==")
    for n, _ in sets:
        print(f"   {n:<14} {score[n]}/{len(CASES)}")
    if dump:
        dump.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
