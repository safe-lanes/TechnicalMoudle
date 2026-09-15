"""Re-score STORED frozen-suite / corrected-claims / manual-coverage dumps with the base judge's markdown normalisation ON
(acceptance_answers .4) versus OFF (.3) — no model calls. Reports every run whose answer verdict changes.
  python indexer/rejudge_base.py <dump.jsonl> [more...]
Dump records carry suite ('answers' → acceptance_answers.CASES, 'generated' → acceptance_generated.CASES, 'manuals' →
manual_cases.json), case id, set, run, verdict, response."""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import acceptance_answers as aa  # noqa: E402
import acceptance_generated as ag  # noqa: E402
from acceptance_manuals import NOT_COVERED as M_NC  # noqa: E402


def case_lookup(suite: str) -> dict:
    if suite == "answers":
        return {str(i): (c[3], c[4], c[5], c[6], c[0]) for i, c in enumerate(aa.CASES, 1)} | {f"{i:02d}": (c[3], c[4], c[5], c[6], c[0]) for i, c in enumerate(aa.CASES, 1)}
    if suite == "generated":
        return {str(i): (c[3], c[4], c[5], c[6], c[0]) for i, c in enumerate(ag.CASES, 1)} | {f"{i:02d}": (c[3], c[4], c[5], c[6], c[0]) for i, c in enumerate(ag.CASES, 1)}
    if suite == "manuals":
        cases = json.load(open(Path(__file__).with_name("manual_cases.json"), encoding="utf-8"))
        return {c["id"]: (c["file"].rsplit(".", 1)[0], c["pages"], c["must"], c["must_not"] + M_NC, "gen") for c in cases}
    return {}


def score(j: dict, normalise: bool) -> tuple[bool, bool]:
    look = case_lookup(j["suite"])
    manual, page, must, must_not, cls = look[str(j["case"])]
    aa.JUDGE_MD_NORMALISE = normalise
    a, ct, _at, _d = aa.judge(j["response"], manual, tuple(page) if isinstance(page, list) else page, must, must_not, cls)
    return a, ct


changed: list[str] = []
totals: Counter = Counter()
for f in sys.argv[1:]:
    for line in open(f, encoding="utf-8"):
        j = json.loads(line)
        if j.get("suite") not in ("answers", "generated", "manuals"):
            continue
        old = score(j, False)
        new = score(j, True)
        totals[(Path(f).name, j["set"], "old_pass")] += old[0] and old[1]
        totals[(Path(f).name, j["set"], "new_pass")] += new[0] and new[1]
        totals[(Path(f).name, j["set"], "runs")] += 1
        if old != new:
            changed.append(f"{Path(f).name} {j['suite']} case {j['case']} {j['set']} run {j['run']}: answer {old[0]}→{new[0]} cite {old[1]}→{new[1]} | {(j['response'].get('response') or '')[:90]!r}")
aa.JUDGE_MD_NORMALISE = True
files = sorted({k[0] for k in totals})
for fn in files:
    sets = sorted({k[1] for k in totals if k[0] == fn})
    for s in sets:
        print(f"{fn:<32} {s:<14} runs {totals[(fn, s, 'runs')]:>3}  pass .3-matching {totals[(fn, s, 'old_pass')]:>3} → .4-matching {totals[(fn, s, 'new_pass')]:>3}")
print(f"\n== run verdicts changed by markdown normalisation ({len(changed)}) ==")
print("\n".join(changed) if changed else "none")
