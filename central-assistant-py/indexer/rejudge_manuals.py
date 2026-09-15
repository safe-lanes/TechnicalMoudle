"""
Re-score a stored manual-coverage dump (acceptance_manuals.py --dump) with a capture file that was not available at run time —
the candidate containers without a bind mount keep their capture inside the container (docker cp afterwards). Nothing is
re-asked; answer/citation verdicts are taken from the dump, only the SUPPORT check (must phrases inside the cited/supplied
excerpts of that very run) is recomputed, and the totals are printed the way acceptance_manuals.py prints them.

  python indexer/rejudge_manuals.py --dump s4-manuals-dump.jsonl --capture D2-hybrid=s4-d2-capture.jsonl [--set D2-hybrid]
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from acceptance_manuals import capture_index, load_cases, support_check  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump", required=True)
    ap.add_argument("--capture", action="append", default=[], help="name=path of that set's capture file")
    ap.add_argument("--set", action="append", default=None, help="restrict to these set names")
    ap.add_argument("--cases", default=str(Path(__file__).with_name("manual_cases.json")))
    args = ap.parse_args()
    cases = {c["id"]: c for c in load_cases(args.cases)}
    caps = {c.partition("=")[0]: capture_index(c.partition("=")[2]) for c in args.capture}
    rows = [json.loads(l) for l in open(args.dump, encoding="utf-8") if l.strip()]
    sets = list(dict.fromkeys(r["set"] for r in rows))
    if args.set:
        sets = [s for s in sets if s in args.set]
    for n in sets:
        used: set[int] = set()
        per_case: dict[str, list[bool]] = defaultdict(list)
        stats = {"supported": 0, "not in excerpts": 0, "not captured": 0, "answer ok but not in excerpts": 0}
        gaps: list[str] = []
        for r in [x for x in rows if x["set"] == n]:  # dump order = case order × run order = capture order
            case = cases[r["case"]]
            sup, _files = support_check(case, r["response"], caps.get(n, []), used)
            a, ct = r["verdict"]["answer"], r["verdict"]["citation"]
            if sup.startswith("supported"):
                stats["supported"] += 1
            elif sup.startswith("not captured"):
                stats["not captured"] += 1
            else:
                stats["not in excerpts"] += 1
                if a:
                    stats["answer ok but not in excerpts"] += 1
                gaps.append(f"{r['case']} r{r['run']}: {sup[:80]}")
            per_case[r["case"]].append(bool(a and ct and sup.startswith(("supported", "not captured"))))
        passing = [c for c, v in per_case.items() if all(v)]
        print(f"\n== {n}: {len(passing)}/{len(per_case)} cases pass all runs (answer ∧ citation ∧ support); runs: {stats}")
        print("   passing:", ", ".join(passing))
        print("   failing:", ", ".join(f"{c}[{sum(v)}/{len(v)}]" for c, v in per_case.items() if not all(v)))
        if gaps:
            print("   runs whose must phrases were NOT in the supplied excerpts (retrieval-level):")
            for g in gaps:
                print("     ", g)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
