"""Validate base judge .7 (decline SCOPE replaces the .6 length shortcut) and the corrected-claims case-06
expectation, on STORED answers only. No service calls, no model calls; nothing is rewritten.

Three scorings are computed over the same stored rows so the two effects never blur together:

  A  judge .6 + case 06 as published   — the baseline whose numbers are already reported
  B  judge .7 + case 06 as published   — the JUDGE change alone
  C  judge .7 + case 06 corrected      — the judge change plus the CASE change (final)

It also prints an audit of every stored answer containing a decline phrase, with the sentence and the class the
new rule gives it, so the classifier can be checked directly rather than only through the flips it causes.

  python indexer/rejudge_base7.py <dump.jsonl> [more dumps...]
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
CASE06_PUBLISHED = ["sail admin", "not enabled"]          # the expectation before today's correction


def case_spec(row, case06_new: bool):
    suite = row.get("suite")
    if suite == "manuals":
        c = MANUAL_CASES[row["case"]]
        return c["file"].rsplit(".", 1)[0], c["pages"], c["must"], c["must_not"] + A.NOT_COVERED, "gen"
    if suite == "generated":
        cls, q, module, manual, page, must, must_not, _src = G.CASES[int(row["case"]) - 1]
        if str(row["case"]) == "6" and not case06_new:
            must = CASE06_PUBLISHED
        return manual, page, must, must_not, cls
    cls, q, module, manual, page, must, must_not, _src = A.CASES[int(row["case"]) - 1]
    return manual, page, must, must_not, cls


def score(rows, scope: bool, case06_new: bool):
    A.JUDGE_CITATION_ANY = A.JUDGE_NEGATION_AWARE = A.JUDGE_DECLINE_AWARE = True
    A.JUDGE_DECLINE_SCOPE = scope
    out = {}
    for r in rows:
        manual, pages, must, must_not, cls = case_spec(r, case06_new)
        a, ct, at, _d = A.judge(r["response"], manual, pages, must, must_not, cls)
        out[(r.get("suite", "answers"), r["set"], str(r["case"]), r["run"])] = (a, ct, at)
    return out


def totals(sc):
    t = defaultdict(lambda: [0, 0])
    for k, v in sc.items():
        t[k[1]][0] += all(v)
        t[k[1]][1] += 1
    return t


audit: list[tuple] = []
n_changed_judge = n_changed_case = 0
for path in sys.argv[1:]:
    rows = [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]
    a_, b_, c_ = score(rows, False, False), score(rows, True, False), score(rows, True, True)
    ta, tb, tc = totals(a_), totals(b_), totals(c_)
    print(f"\n== {path}")
    for st in sorted(ta):
        print(f"   {st:<14} runs passing:  A .6/case06 published {ta[st][0]:>3}/{ta[st][1]}"
              f"   B .7/case06 published {tb[st][0]:>3}/{tb[st][1]}"
              f"   C .7/case06 corrected {tc[st][0]:>3}/{tc[st][1]}")
    for k in a_:
        if a_[k] != b_[k]:
            n_changed_judge += 1
            print(f"      JUDGE CHANGE  {k[0]} {k[1]} case {k[2]} run {k[3]}: {a_[k]} -> {b_[k]}")
        if b_[k] != c_[k]:
            n_changed_case += 1
            print(f"      CASE  CHANGE  {k[0]} {k[1]} case {k[2]} run {k[3]}: {b_[k]} -> {c_[k]}")
    # audit every decline phrase in every stored answer
    for r in rows:
        manual, pages, must, must_not, cls = case_spec(r, True)
        text = A.md_plain(r["response"].get("response") or "").lower()
        _c = r["response"].get("citations") or []
        _pp = (pages,) if isinstance(pages, int) else pages
        cited_exp = any(manual.lower() in str(x.get("manual", "")).lower()
                        and (_pp is None or A.page_of(x) in _pp) for x in _c)
        for p in set(must_not) & A.DECLINE_PHRASES:
            if p not in text:
                continue
            for s in A._sentences(text):
                if p in s and not A.negated(s, p):
                    audit.append((r.get("suite", "answers"), r["set"], str(r["case"]), r["run"], p,
                                  A.decline_class(s, manual, cited_exp), manual, s.strip()[:220]))

print(f"\nJUDGE .6 -> .7 changed verdicts: {n_changed_judge}")
print(f"CASE 06 change changed verdicts: {n_changed_case}")

print(f"\n== decline-phrase audit: {len(audit)} asserted occurrences in the stored answers")
by_class = defaultdict(int)
for a in audit:
    by_class[a[5]] += 1
for k, v in sorted(by_class.items()):
    print(f"   {k:<16} {v}")
for a in sorted(audit, key=lambda x: (x[5], x[0], x[2])):
    print(f"\n  [{a[5]}] {a[0]} {a[1]} case {a[2]} run {a[3]} | phrase {a[4]!r} | expected source {a[6]!r}\n     {a[7]}")
