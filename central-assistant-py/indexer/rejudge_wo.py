"""Re-judge STORED work-order answers with judge versions 3, 4, 5 and 6 side by side — no new LLM calls.
  python indexer/rejudge_wo.py <dump.jsonl | diag-results.json> [more files...] [--scopes] [--from N]
Inputs: a suite --dump (one JSON per line: case/set/run/verdict/response) or a diagnostic results file (diag_overview.py /
diag_dedup.py / diag_prompt.py: {"runs": [{case, arm|prompt, run, answer|response}, ...]}, judged on the rule alone — no manual/page check there).
--scopes prints, for every answer that names Generate Now or Generate WO, the text each judge version attributed to that
action (manual check of the attribution). --from N (default 4) sets the OLD version that changed verdicts are reported against."""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from acceptance_wo import CASES, GN_RE, GW_RE, PHRASINGS, block_for, body_of, extra_rule, scopes_of, scopes_v7  # noqa: E402

rules = {cid: rule for cid, _q, _m, _man, _p, _must, _mn, rule, _s in CASES}
rules.update({cid: rule for cid, _q, rule in PHRASINGS})
argv = sys.argv[1:]
show_scopes = "--scopes" in argv
OLD = int(argv[argv.index("--from") + 1]) if "--from" in argv else 4
files = [a for i, a in enumerate(argv) if not a.startswith("--") and (i == 0 or argv[i - 1] != "--from")]
VERSIONS = (3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
NEW = VERSIONS[-1]


def load(f: str) -> list[dict]:
    if f.endswith(".json"):
        d = json.load(open(f, encoding="utf-8"))
        return [{"case": r["case"], "set": r.get("arm") or r.get("prompt"), "run": r["run"], "verdict": {"answer": True, "citation": True},
                 "response": {"response": r["response"]["response"] if "response" in r else r["answer"], "gate": "answer"}} for r in d["runs"]]
    return [json.loads(line) for line in open(f, encoding="utf-8")]


def verdict(j: dict, v: int) -> tuple[bool, str]:
    text = j["response"].get("response") or ""
    a, ct = j["verdict"]["answer"], j["verdict"]["citation"]
    ok, why = extra_rule(rules[j["case"]], text, version=v)
    # the 'must' phrases for wo-phr-02 changed in .4 (only 'unplanned w.o' required) — recompute 'answer' for it
    if v >= 4 and rules[j["case"]] == "unplanned-plus-note":
        a = "unplanned w.o" in text.lower() and j["response"].get("gate") == "answer"
    return bool(a and ct and ok), why


changed_rule: list[str] = []
changed_verdict: list[str] = []
for f in files:
    runs: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for j in load(f):
        runs[(j["case"], j["set"])].append(j)
    print(f"\n===== {Path(f).name}")
    print(f"{'case':<14} {'set':<12} " + " ".join(f"{'judge .' + str(v):<10}" for v in VERSIONS) + f" last-run .{NEW} reason")
    for (cid, s), items in sorted(runs.items()):
        items.sort(key=lambda x: x["run"])
        cols = {}
        for v in VERSIONS:
            vs = [verdict(j, v) for j in items]
            cols[v] = (sum(ok for ok, _ in vs), len(vs), vs[-1][1])
        for j in items:
            text = j["response"].get("response") or ""
            ok_old, why_old = extra_rule(rules[cid], text, version=OLD)
            ok_new, why_new = extra_rule(rules[cid], text, version=NEW)
            if (ok_old, why_old) != (ok_new, why_new):
                changed_rule.append(f"{Path(f).name[:6]} {cid} {s} run {j['run']}: rule .{OLD}={ok_old} ({why_old}) → .{NEW}={ok_new} ({why_new})")
            vo, vn = verdict(j, OLD)[0], verdict(j, NEW)[0]
            if vo != vn:
                changed_verdict.append(f"{Path(f).name[:6]} {cid} {s} run {j['run']}: .{OLD} {'PASS' if vo else 'fail'} → .{NEW} {'PASS' if vn else 'fail'}")
        print(f"{cid:<14} {s:<12} " + " ".join(f"{cols[v][0]}/{cols[v][1]} {'PASS' if cols[v][0] == cols[v][1] else 'fail':<5}" for v in VERSIONS) + f"  {cols[NEW][2][:90]}")
        if show_scopes:
            for j in items:
                b = body_of(j["response"].get("response") or "", 7)
                sc = scopes_of(b)
                s7 = scopes_v7(b)
                if not (re.search(GN_RE, b) or re.search(GW_RE, b)):
                    continue
                print(f"   -- run {j['run']}")
                print(f"      .4 GN block: {re.sub(r'\\s+', ' ', block_for(b, GN_RE))[:260]}")
                print(f"      .5 GN scope: {re.sub(r'\\s+', ' ', sc['GN'])[:260]}")
                print(f"      .4 GW block: {re.sub(r'\\s+', ' ', block_for(b, GW_RE))[:260]}")
                print(f"      .5 GW scope: {re.sub(r'\\s+', ' ', sc['GW'])[:260]}")
                print(f"      .5 UN scope: {re.sub(r'\\s+', ' ', sc['UN'])[:260]}")
                print(f"      .7 GN scope: {re.sub(r'\\s+', ' ', s7['GN'])[:320]}")
                print(f"      .7 GW scope: {re.sub(r'\\s+', ' ', s7['GW'])[:320]}")
                print(f"      .7 UN scope: {re.sub(r'\\s+', ' ', s7['UN'])[:320]}")
print(f"\n== RULE-level outcome changes .{OLD} → .{NEW} ({len(changed_rule)}) ==")
print("\n".join(changed_rule) if changed_rule else "none")
print(f"\n== overall PASS/fail changes per run .{OLD} → .{NEW} ({len(changed_verdict)}) ==")
print("\n".join(changed_verdict) if changed_verdict else "none")
