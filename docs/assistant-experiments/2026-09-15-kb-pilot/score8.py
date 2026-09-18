# Offline scorer for judge .8 — re-scores stored runs against the CAPTURED MODEL INPUT, which is what the .8
# citation-support and missing-evidence rules are decided on. No service calls, no model calls, nothing rewritten.
#
# Reports, per suite and per arm:
#   * majority-of-runs and all-three-runs totals, SEPARATELY (never merged into one headline)
#   * first-source ranking as its own column, never folded into the pass
#   * every case flagged REVIEW-NEEDED (support or a missing-evidence claim not decidable automatically)
#   * with --diff A B, the per-case gains and losses between two arms under each rule
#
#   python score8.py [--diff A B] [--captures ARM=path ...] <dump.jsonl> [more dumps...]
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
WO_SPEC = {c[0]: c for c in W.CASES}
WO_RULE = {c[0]: c[7] for c in W.CASES}
WO_RULE.update({p[0]: p[2] for p in W.PHRASINGS})
WO_Q = {c[0]: c[1] for c in W.CASES}
WO_Q.update({p[0]: p[1] for p in W.PHRASINGS})
RULE = {"answers": "majority", "generated": "majority", "wo": "all", "manuals": "all", "fresh": "all", "routing": "all"}

CAPS: dict[str, dict[str, list[str]]] = {}
USED: dict[str, dict[str, int]] = {}


def load_captures(arm: str, path: str):
    out = defaultdict(list)
    for line in open(path, encoding="utf-8"):
        rec = json.loads(line)
        if "chat/completions" not in rec.get("url", ""):
            continue
        body = json.loads(rec["body"])
        user = next((m["content"] for m in body.get("messages", []) if m.get("role") == "user"), "")
        if "\n\nQuestion: " not in user:
            continue
        q = user.rsplit("\n\nQuestion: ", 1)[-1].strip()
        out[q].append(user.split("Manual excerpts:\n\n", 1)[-1].rsplit("\n\nQuestion:", 1)[0])
    CAPS[arm] = out
    USED[arm] = defaultdict(int)


NRUNS = 3


def supplied_for(arm: str, question: str, run: int) -> str | None:
    """The captured input for this run. Runs are sequential in every runner, so the run-th capture of a question
    is that run's input — counted from the END of the capture file, because a capture file can also hold calls
    from an earlier aborted attempt at the same suite. The dumps always hold the LAST completed run."""
    lst = (CAPS.get(arm) or {}).get(question) or []
    if len(lst) >= NRUNS and 0 < run <= NRUNS:
        return lst[len(lst) - NRUNS + run - 1]
    return lst[run - 1] if 0 < run <= len(lst) else None


def spec(row):
    """(expected document substring, pages, must, must_not, cls, question, scoped_must)"""
    suite, case = row.get("suite", "answers"), str(row["case"])
    if suite == "manuals":
        c = MANUALS[case]
        return c["file"].rsplit(".", 1)[0], c["pages"], c["must"], c["must_not"] + A.NOT_COVERED, "gen", c["question"], None
    if suite == "generated":
        cls, q, _m, manual, page, must, must_not, _s = G.CASES[int(case) - 1]
        return manual, page, must, must_not, cls, q, G.SCOPED_MUST.get(int(case))
    if suite == "wo":
        base = W.CASES[0]
        if case in WO_SPEC:
            _c, q, _m, manual, page, must, must_not, _r, _s = WO_SPEC[case]
        else:
            manual, page, must_not = base[3], base[4], base[6]
            must = ["unplanned w.o"] if WO_RULE[case] == "unplanned-plus-note" else base[5]
        return manual, page, must, must_not, "gen", WO_Q[case], None
    if suite == "fresh":
        c = FRESH[case]
        return (c.get("file") or "").rsplit(".", 1)[0], c.get("pages"), c["must"], c["must_not"], "gen", c["question"], None
    cls, q, _m, manual, page, must, must_not, _s = A.CASES[int(case) - 1]
    return manual, page, must, must_not, cls, q, None


def verdict(row):
    suite = row.get("suite", "answers")
    resp = row["response"]
    if suite == "routing":
        v = row.get("ok", row.get("verdict"))
        return {"pass": bool(all(v.values()) if isinstance(v, dict) else v), "cite_first": None, "review": [],
                "detail": "routing (module decision, not text-judged)"}
    manual, pages, must, must_not, cls, question, scoped = spec(row)
    sup = supplied_for(row["set"], question, row.get("run", 1))
    if suite == "fresh":
        import acceptance_fresh as F
        a, m, ct, d = F.judge(FRESH[str(row["case"])], resp, sup)
        # fresh keeps its own module check; the .8 phrase equivalence reaches it through A.present
        return {"pass": bool(a and m and ct), "cite_first": None, "review": [], "detail": d}
    v = A.judge_ex(resp, manual, pages, must, must_not, cls, supplied=sup, scoped_must=scoped)
    ok = v["answer"] and v["citation"] and (v["attribution"] if suite == "answers" else True)
    if suite == "manuals":
        stored = str((row.get("verdict") or {}).get("support", "not captured"))
        ok = ok and stored.startswith(("supported", "not captured"))
    if suite == "wo":
        ok_extra, why = W.extra_rule(WO_RULE[str(row["case"])], resp.get("response") or "")
        ok = ok and ok_extra
        v["detail"] += f" | rule={why}" 
    return {"pass": bool(ok), "cite_first": v["cite_first"], "review": v["review"], "detail": v["detail"],
            "support": v["support"], "scope_fail": v["scope_fail"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--diff", nargs=2, default=None, metavar=("ARM_A", "ARM_B"))
    ap.add_argument("--captures", action="append", default=[], metavar="ARM=PATH")
    ap.add_argument("dumps", nargs="+")
    args = ap.parse_args()
    for c in args.captures:
        arm, _, path = c.partition("=")
        load_captures(arm, path if os.path.isabs(path) else os.path.join(HERE, path))

    data = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    for path in args.dumps:
        for line in open(path, encoding="utf-8"):
            if line.strip():
                r = json.loads(line)
                data[r.get("suite", "answers")][r["set"]][str(r["case"])][r.get("run", 1)] = verdict(r)

    print(f"Judge .{A.JUDGE_VERSION} (exact document identity + supplied-excerpt support + supplied-excerpt "
          f"missing-evidence test + documented phrase equivalence), work-order judge .{W.JUDGE_VERSION}, "
          f"corrected-claims cases {G.GEN_SUITE_VERSION}.")
    print(f"Captures loaded for: {', '.join(sorted(CAPS)) or 'none'}. Scored from stored answers; no model calls.\n")
    reviews = []
    for suite in sorted(data):
        arms = sorted(data[suite])
        cases = sorted({c for a in arms for c in data[suite][a]})
        print(f"== {suite}  ({len(cases)} cases; the runner applies: {RULE.get(suite, '?')})")
        for arm in arms:
            def runs_of(c):
                return [x["pass"] for x in data[suite][arm][c].values()]
            maj = sum(1 for c in cases if (v := runs_of(c)) and sum(v) * 2 > len(v))
            allr = sum(1 for c in cases if (v := runs_of(c)) and all(v))
            runs = [p for c in cases for p in runs_of(c)]
            firsts = [x["cite_first"] for c in cases for x in data[suite][arm][c].values() if x["cite_first"] is not None]
            fs = f"   first-source {sum(1 for f in firsts if f)}/{len(firsts)} runs" if firsts else ""
            print(f"   {arm:<16} majority {maj:>3}/{len(cases)}   all-three {allr:>3}/{len(cases)}   "
                  f"runs {sum(runs):>3}/{len(runs)}{fs}")
            for c in cases:
                for run, x in sorted(data[suite][arm][c].items()):
                    for rv in x["review"]:
                        # a review flag matters when the run PASSES on something unverified, or when a
                        # missing-evidence claim could not be decided; a run that fails anyway needs no review
                        if x["pass"] or "not decidable" in rv:
                            reviews.append((suite, arm, c, run, rv))
        if args.diff and all(a in arms for a in args.diff):
            a1, a2 = args.diff
            for rulename in ("majority", "all"):
                def passes(arm, c):
                    v = [x["pass"] for x in data[suite][arm][c].values()]
                    return bool(v) and (sum(v) * 2 > len(v) if rulename == "majority" else all(v))
                lines = []
                for c in cases:
                    p1, p2 = passes(a1, c), passes(a2, c)
                    if p1 != p2:
                        v1 = "".join("P" if x[1]["pass"] else "f" for x in sorted(data[suite][a1][c].items()))
                        v2 = "".join("P" if x[1]["pass"] else "f" for x in sorted(data[suite][a2][c].items()))
                        lines.append(f"      [{rulename}] {'GAIN' if p2 else 'LOSS':<5} case {c:<18} {a1} [{v1}] -> {a2} [{v2}]")
                for ln in lines:
                    print(ln)
        print()

    print(f"== REVIEW-NEEDED (not decided automatically; source-based review required): {len(reviews)}")
    for suite, arm, c, run, rv in reviews:
        print(f"   {suite:<10} {arm:<6} case {c:<18} run {run}: {rv}")


if __name__ == "__main__":
    main()
