"""Re-judge STORED work-order answers (a --dump file) with judge version 3 and 4 side by side — no new LLM calls.
  python indexer/rejudge_wo.py docs/assistant-experiments/2026-09-15-kb-pilot/kb2-wo-dump.jsonl"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from acceptance_wo import CASES, PHRASINGS, extra_rule  # noqa: E402

rules = {cid: rule for cid, _q, _m, _man, _p, _must, _mn, rule, _s in CASES}
rules.update({cid: rule for cid, _q, rule in PHRASINGS})
runs: dict[tuple[str, str], list[dict]] = defaultdict(list)
for line in open(sys.argv[1], encoding="utf-8"):
    j = json.loads(line)
    runs[(j["case"], j["set"])].append(j)
print(f"{'case':<14} {'set':<12} {'judge .3 (stored verdict → rule v3)':<38} {'judge .4 (rule v4)':<20} note")
for (cid, s), items in sorted(runs.items()):
    items.sort(key=lambda x: x["run"])
    v3 = []
    v4 = []
    for j in items:
        text = j["response"].get("response") or ""
        a, ct = j["verdict"]["answer"], j["verdict"]["citation"]
        ok3, _ = extra_rule(rules[cid], text, version=3)
        ok4, why4 = extra_rule(rules[cid], text, version=4)
        # the 'must' phrases for wo-phr-02 changed in .4 (only 'unplanned w.o' required) — recompute 'answer' for it
        a4 = a if rules[cid] != "unplanned-plus-note" else ("unplanned w.o" in text.lower() and j["response"].get("gate") == "answer")
        v3.append(a and ct and ok3)
        v4.append(a4 and ct and ok4)
    print(f"{cid:<14} {s:<12} {sum(v3)}/{len(v3)} {'PASS' if all(v3) else 'fail':<30} {sum(v4)}/{len(v4)} {'PASS' if all(v4) else 'fail':<12} {why4[:70]}")
