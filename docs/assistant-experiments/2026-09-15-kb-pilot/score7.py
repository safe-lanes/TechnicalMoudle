# Re-score stored dumps under the CURRENT judges (base .7 + work-order .12 + corrected-claims case 06 as corrected).
# Reads saved dumps only — no service calls, no model calls, nothing rewritten. Prints, per suite and per arm:
#   totals under BOTH pass rules (majority-of-runs and all-runs-required), and every per-case difference between arms.
#
#   python score7.py <dump.jsonl> [more dumps...]            # totals for whatever arms the dumps contain
#   python score7.py --diff A B  <dump.jsonl> ...            # plus a per-case gain/loss table between arms A and B
import argparse
import json
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
IDX = os.path.join(HERE, "..", "..", "..", "central-assistant-py", "indexer")
sys.path.insert(0, IDX)
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "central-assistant-py"))

import acceptance_answers as A      # noqa: E402
import acceptance_generated as G    # noqa: E402
import acceptance_wo as W           # noqa: E402

MANUALS = {c["id"]: c for c in json.load(open(os.path.join(IDX, "manual_cases.json"), encoding="utf-8"))}
FRESH = {c["id"]: c for c in json.load(open(os.path.join(IDX, "fresh_cases.json"), encoding="utf-8"))["cases"]}
WO_RULE = {c[0]: c[7] for c in W.CASES}
WO_RULE.update({p[0]: p[2] for p in W.PHRASINGS})
WO_SPEC = {c[0]: c for c in W.CASES}
# suite -> pass rule actually used by that suite's runner
RULE = {"answers": "majority", "generated": "majority", "wo": "all", "manuals": "all", "fresh": "all", "routing": "all"}


def verdict(row):
    """Recompute this run's verdict with the current judges. Returns (ok, detail)."""
    suite = row.get("suite", "answers")
    resp = row["response"]
    if suite == "routing":
        v = row.get("ok", row.get("verdict"))
        return bool(all(v.values()) if isinstance(v, dict) else v), "routing (stored verdict — routing is not judged by text)"
    if suite == "manuals":
        c = MANUALS[row["case"]]
        a, ct, _at, d = A.judge(resp, c["file"].rsplit(".", 1)[0], c["pages"], c["must"], c["must_not"] + A.NOT_COVERED, "gen")
        sup = str((row.get("verdict") or {}).get("support", "not captured"))
        return bool(a and ct and sup.startswith(("supported", "not captured"))), d
    if suite == "generated":
        cls, q, module, manual, page, must, must_not, _s = G.CASES[int(row["case"]) - 1]
        a, ct, _at, d = A.judge(resp, manual, page, must, must_not, cls)
        return bool(a and ct), d
    if suite == "wo":
        cid = row["case"]
        base = W.CASES[0]
        if cid in WO_SPEC:
            _cid, q, module, manual, page, must, must_not, rule, _s = WO_SPEC[cid]
        else:
            rule = WO_RULE[cid]
            manual, page = base[3], base[4]
            must = ["unplanned w.o"] if rule == "unplanned-plus-note" else base[5]
            must_not = base[6]
        a, ct, _at, d = A.judge(resp, manual, page, must, must_not, "gen")
        ok_extra, why = W.extra_rule(rule, resp.get("response") or "")
        return bool(a and ct and ok_extra), f"{d} | rule={why}"
    if suite == "fresh":
        import acceptance_fresh as F
        a, m, ct, d = F.judge(FRESH[row["case"]], resp)
        return bool(a and m and ct), d
    cls, q, module, manual, page, must, must_not, _s = A.CASES[int(row["case"]) - 1]
    a, ct, at, d = A.judge(resp, manual, page, must, must_not, cls)
    return bool(a and ct and at), d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--diff", nargs=2, default=None, metavar=("ARM_A", "ARM_B"))
    ap.add_argument("dumps", nargs="+")
    args = ap.parse_args()

    # suite -> arm -> case -> {run: (ok, detail)}
    data = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    for path in args.dumps:
        for line in open(path, encoding="utf-8"):
            if not line.strip():
                continue
            r = json.loads(line)
            suite = r.get("suite", "answers")
            data[suite][r["set"]][str(r["case"])][r.get("run", 1)] = verdict(r)

    print("Re-scored from stored answers with the current judges: base "
          f"{A.SUITE_VERSION}/.{A.JUDGE_VERSION}, work-order judge .{W.JUDGE_VERSION}, "
          f"corrected-claims cases {G.GEN_SUITE_VERSION}. No model calls.\n")
    for suite in sorted(data):
        arms = sorted(data[suite])
        cases = sorted({c for a in arms for c in data[suite][a]})
        print(f"== {suite}  ({len(cases)} cases, pass rule used by the runner: {RULE.get(suite, '?')})")
        for arm in arms:
            maj = sum(1 for c in cases if (v := [x[0] for x in data[suite][arm][c].values()]) and sum(v) * 2 > len(v))
            allr = sum(1 for c in cases if (v := [x[0] for x in data[suite][arm][c].values()]) and all(v))
            runs = [x[0] for c in cases for x in data[suite][arm][c].values()]
            star = "  <- rule used" if RULE.get(suite) else ""
            print(f"   {arm:<16} majority {maj:>3}/{len(cases)}   all-runs {allr:>3}/{len(cases)}   "
                  f"runs {sum(runs):>3}/{len(runs)}{star}")
        if args.diff and all(a in arms for a in args.diff):
            a1, a2 = args.diff
            rule = RULE.get(suite, "all")
            def passes(arm, c):
                v = [x[0] for x in data[suite][arm][c].values()]
                return bool(v) and (sum(v) * 2 > len(v) if rule == "majority" else all(v))
            for c in cases:
                p1, p2 = passes(a1, c), passes(a2, c)
                if p1 != p2:
                    v1 = "".join("P" if x[1][0] else "f" for x in sorted(data[suite][a1][c].items()))
                    v2 = "".join("P" if x[1][0] else "f" for x in sorted(data[suite][a2][c].items()))
                    print(f"      {'GAIN' if p2 else 'LOSS':<5} case {c:<18} {a1} [{v1}] -> {a2} [{v2}]")
        print()


if __name__ == "__main__":
    main()
