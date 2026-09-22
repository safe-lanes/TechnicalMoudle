# Judge the cross-reference answer comparison against the FROZEN expectations.
#
# Three buckets, reported separately for every arm and every run, never merged:
#   correct    the destination procedure, with citations, breaking no must_not rule
#   limited    honest but incomplete — no procedure given, or a case capped at 'limited'
#   incorrect  a must_not hit: the source screen, record type or an unverified field survived
#
# must_not is decisive. A case with bucket_cap can never score above that bucket.
# The judge reads the FINAL ANSWER, not the indexed text — the point of the test is that the old
# instructions are still present in the quoted part of the document.
#
#   python judge_xref.py            # table
#   python judge_xref.py --read     # + every answer in full, for reading
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = json.loads((HERE / "xref_expectations.json").read_text(encoding="utf-8"))
CASES = {c["id"]: c for c in SPEC["cases"]}
D = json.loads((HERE / "xref-answers.json").read_text(encoding="utf-8"))

# a procedural answer tells the reader to do something, more than once
STEP = re.compile(r"(?:^|\n)\s*(?:\d+[.)]|[-*•])\s|\b(?:click|select|choose|enter|open|go to)\b", re.I)


def judge(case: dict, text: str) -> tuple[str, list[str]]:
    """(bucket, reasons). Reads the answer only."""
    t = (text or "").lower()
    reasons = []
    hits = [p for p in case.get("must_not", []) if p.lower() in t]
    if hits:
        return "incorrect", [f"must_not hit: {', '.join(repr(h) for h in hits)}"]

    missing_any = [g for g in case.get("must_include_any", []) if not any(w.lower() in t for w in g)]
    missing_all = [g for g in case.get("must_include_all", []) if not all(w.lower() in t for w in g)]
    if missing_any or missing_all:
        reasons.append(f"missing required term(s): {missing_any + missing_all}")
        return "limited", reasons

    if len(STEP.findall(text or "")) < 2:
        reasons.append("no procedure given (fewer than two instruction markers)")
        return "limited", reasons

    cap = case.get("bucket_cap")
    if cap:
        reasons.append(f"capped at '{cap}': {case.get('bucket_cap_reason', '')[:90]}")
        return cap, reasons
    return "correct", reasons


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--read", action="store_true")
    args = ap.parse_args()
    R = D["results"]
    errs = [r for r in R if r.get("error")]
    print(f"{len(R)} answers · {D['runs']} runs · {len(CASES)} frozen cases · errors {len(errs)}")
    for e in errs[:4]:
        print("   ERROR", e["id"], e["arm"], str(e["error"])[:80])

    verdict = {}
    for r in R:
        verdict[(r["id"], r["arm"], r["run"])] = judge(CASES[r["id"]], r.get("response") or "")

    print(f"\n{'case':<26} " + " ".join(f"{a+' r'+str(i):<14}" for a in D["arms"] for i in (1, 2, 3)))
    print("-" * 112)
    for cid in CASES:
        row = " ".join(f"{verdict[(cid, a, i)][0]:<14}" for a in D["arms"] for i in (1, 2, 3))
        print(f"{cid:<26} {row}")

    print("\nTOTALS per arm (each of 3 runs counted separately)")
    for arm in D["arms"]:
        tal = defaultdict(int)
        for cid in CASES:
            for i in (1, 2, 3):
                tal[verdict[(cid, arm, i)][0]] += 1
        n = sum(tal.values())
        print(f"   {arm:<10} correct {tal['correct']:>2}/{n}   limited {tal['limited']:>2}/{n}   "
              f"incorrect {tal['incorrect']:>2}/{n}")

    print("\nWHY, per case (run 1 shown; differences across runs flagged)")
    for cid in CASES:
        for arm in D["arms"]:
            bs = [verdict[(cid, arm, i)][0] for i in (1, 2, 3)]
            note = "" if len(set(bs)) == 1 else f"   [varies across runs: {bs}]"
            why = "; ".join(verdict[(cid, arm, 1)][1]) or "-"
            print(f"   {cid:<26} {arm:<10} {bs[0]:<10} {why[:70]}{note}")

    if args.read:
        for cid in CASES:
            print("\n" + "=" * 110)
            print(f"{cid}   Q: {CASES[cid]['question']}")
            print(f"   must_not: {CASES[cid].get('must_not')}")
            for arm in D["arms"]:
                for i in (1, 2, 3):
                    r = next(x for x in R if x["id"] == cid and x["arm"] == arm and x["run"] == i)
                    b, why = verdict[(cid, arm, i)]
                    print(f"\n--- {arm} run {i} [{b}] {'; '.join(why)}")
                    cites = [f"{c.get('module')}:{str(c.get('manual'))[:34]}" for c in (r.get("citations") or [])]
                    print("    cites: " + (", ".join(cites) or "-"))
                    print("    " + (r.get("response") or "").replace("\n", "\n    ")[:1400])


if __name__ == "__main__":
    main()
