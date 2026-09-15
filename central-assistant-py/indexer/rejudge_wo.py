"""Re-judge STORED work-order answers (one or more --dump files) with judge versions 3, 4 and 5 side by side — no new LLM calls.
  python indexer/rejudge_wo.py docs/assistant-experiments/2026-09-15-kb-pilot/kb2-wo-dump.jsonl [more dumps...]
Add --scopes to print, for every answer that describes Generate Now or Generate WO, the exact text each judge version
attributed to that action (manual check of the attribution, owner rule 15-Sep)."""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from acceptance_wo import CASES, GN_RE, GW_RE, PHRASINGS, block_for, body_of, extra_rule, scopes_of  # noqa: E402

rules = {cid: rule for cid, _q, _m, _man, _p, _must, _mn, rule, _s in CASES}
rules.update({cid: rule for cid, _q, rule in PHRASINGS})
show_scopes = "--scopes" in sys.argv
files = [a for a in sys.argv[1:] if not a.startswith("--")]
VERSIONS = (3, 4, 5)


def verdict(j: dict, v: int) -> tuple[bool, str]:
    text = j["response"].get("response") or ""
    a, ct = j["verdict"]["answer"], j["verdict"]["citation"]
    ok, why = extra_rule(rules[j["case"]], text, version=v)
    # the 'must' phrases for wo-phr-02 changed in .4 (only 'unplanned w.o' required) — recompute 'answer' for it
    if v >= 4 and rules[j["case"]] == "unplanned-plus-note":
        a = "unplanned w.o" in text.lower() and j["response"].get("gate") == "answer"
    return bool(a and ct and ok), why


changed: list[str] = []
for f in files:
    runs: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for line in open(f, encoding="utf-8"):
        j = json.loads(line)
        runs[(j["case"], j["set"])].append(j)
    print(f"\n===== {Path(f).name}")
    print(f"{'case':<14} {'set':<12} {'judge .3':<10} {'judge .4':<10} {'judge .5':<10} last-run .5 reason")
    for (cid, s), items in sorted(runs.items()):
        items.sort(key=lambda x: x["run"])
        cols = {}
        for v in VERSIONS:
            vs = [verdict(j, v) for j in items]
            cols[v] = (sum(ok for ok, _ in vs), len(vs), vs[-1][1])
            for j, (ok, why) in zip(items, vs, strict=True):
                if v == 5:
                    ok4, why4 = verdict(j, 4)
                    if ok4 != ok:
                        changed.append(f"{Path(f).name[:3]} {cid} {s} run {j['run']}: .4 {'PASS' if ok4 else 'fail'} → .5 {'PASS' if ok else 'fail'} | .4: {why4} | .5: {why}")
        print(f"{cid:<14} {s:<12} " + " ".join(f"{cols[v][0]}/{cols[v][1]} {'PASS' if cols[v][0] == cols[v][1] else 'fail':<5}" for v in VERSIONS) + f"  {cols[5][2][:80]}")
        if show_scopes:
            for j in items:
                b = body_of(j["response"].get("response") or "")
                sc = scopes_of(b)
                if not (re.search(GN_RE, b) or re.search(GW_RE, b)):
                    continue
                print(f"   -- run {j['run']}")
                print(f"      .4 GN block: {re.sub(r'\\s+', ' ', block_for(b, GN_RE))[:260]}")
                print(f"      .5 GN scope: {re.sub(r'\\s+', ' ', sc['GN'])[:260]}")
                print(f"      .4 GW block: {re.sub(r'\\s+', ' ', block_for(b, GW_RE))[:260]}")
                print(f"      .5 GW scope: {re.sub(r'\\s+', ' ', sc['GW'])[:260]}")
print("\n== verdicts changed .4 → .5 ==")
print("\n".join(changed) if changed else "none")
