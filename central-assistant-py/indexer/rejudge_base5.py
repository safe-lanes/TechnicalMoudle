"""Validate base judge .5 (citation-anywhere + negation-aware must_not) on STORED answers only.

Re-scores every saved dump with .4 and with .5 and prints each changed verdict, so the two demonstrated judge defects
can be seen to change exactly what they were meant to change and nothing else. Old scores are preserved: the dumps and
the earlier reported totals are untouched — this prints a comparison, it does not rewrite anything.

  python indexer/rejudge_base5.py <dump.jsonl> [more dumps...]
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import acceptance_answers as A  # noqa: E402
import acceptance_generated as G  # noqa: E402

MANUAL_CASES = {c["id"]: c for c in json.loads(Path(__file__).with_name("manual_cases.json").read_text(encoding="utf-8"))}


def case_spec(row):
    """(manual, pages, must, must_not, cls) for a dump row, whichever suite it came from."""
    suite = row.get("suite")
    if suite == "manuals":
        c = MANUAL_CASES[row["case"]]
        return c["file"].rsplit(".", 1)[0], c["pages"], c["must"], c["must_not"] + A.NOT_COVERED, "gen"
    if suite == "generated":
        cls, q, module, manual, page, must, must_not, _src = G.CASES[int(row["case"]) - 1]
        return manual, page, must, must_not, cls
    cls, q, module, manual, page, must, must_not, _src = A.CASES[int(row["case"]) - 1]
    return manual, page, must, must_not, cls


def score(rows, cit_any, neg):
    A.JUDGE_CITATION_ANY, A.JUDGE_NEGATION_AWARE = cit_any, neg
    out = {}
    for r in rows:
        manual, pages, must, must_not, cls = case_spec(r)
        a, ct, at, _d = A.judge(r["response"], manual, pages, must, must_not, cls)
        out[(r.get("suite", "answers"), r["set"], str(r["case"]), r["run"])] = (a, ct, at)
    return out


changed = defaultdict(list)
for path in sys.argv[1:]:
    rows = [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]
    old, new = score(rows, False, False), score(rows, True, True)
    for k in old:
        if old[k] != new[k]:
            changed[path].append((k, old[k], new[k]))
    tot_old = defaultdict(lambda: [0, 0])
    tot_new = defaultdict(lambda: [0, 0])
    for k, v in old.items():
        tot_old[k[1]][0] += all(v)
        tot_old[k[1]][1] += 1
    for k, v in new.items():
        tot_new[k[1]][0] += all(v)
        tot_new[k[1]][1] += 1
    print(f"\n== {path}")
    for st in sorted(tot_old):
        print(f"   {st:<14} runs passing: .4 {tot_old[st][0]}/{tot_old[st][1]}   ->   .5 {tot_new[st][0]}/{tot_new[st][1]}")
    for k, o, n in changed[path]:
        print(f"      CHANGED {k[0]} {k[1]} case {k[2]} run {k[3]}: answer/cite/attr {o} -> {n}")
print(f"\nTOTAL changed verdicts: {sum(len(v) for v in changed.values())}")
