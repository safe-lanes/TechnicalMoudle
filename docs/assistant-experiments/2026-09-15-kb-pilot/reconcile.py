# Step 1 of the owner brief of 18-Sep: reconcile every published number against the STORED runs.
# Reads only saved dumps and captures (no service calls, no model calls) and prints, per suite:
#   - which dump/set each published column actually came from (provenance — several columns were run on different images)
#   - per-case, per-run verdicts for C0 / D1 / D4 side by side
#   - gains, losses and unchanged, computed from the dumps rather than quoted
# Usage: python reconcile.py > reconcile.txt
import json
import os
import re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))


def rows(name):
    p = os.path.join(HERE, name)
    if not os.path.exists(p):
        return []
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def pass_of(r, suite):
    v = r["verdict"]
    if suite == "wo":
        return bool(v.get("answer") and v.get("citation") and v.get("rule"))
    if suite == "frozen":
        return bool(v.get("answer") and v.get("citation") and v.get("attribution"))
    if suite == "generated":
        return bool(v.get("answer") and v.get("citation"))
    if suite == "manuals":
        sup = str(v.get("support", ""))
        return bool(v.get("answer") and v.get("citation") and sup.startswith(("supported", "not captured")))
    raise ValueError(suite)


def collect(files, suite):
    """{set: {case: [run verdicts in run order]}} merged over several dumps."""
    out = defaultdict(lambda: defaultdict(dict))
    for f in files:
        for r in rows(f):
            out[r["set"]][str(r["case"])][r["run"]] = r
    return {s: {c: [runs[k] for k in sorted(runs)] for c, runs in cases.items()} for s, cases in out.items()}


def rule_totals(votes, rule):
    return all(votes) if rule == "all" else (sum(votes) * 2 > len(votes))


def table(title, data, order, suite, case_label=None, rule="all"):
    print(f"\n### {title}")
    cases = sorted({c for s in order if s in data for c in data[s]}, key=lambda x: (len(x), x))
    head = f"{'case':<26}" + "".join(f"{s:<16}" for s in order)
    print(head)
    totals = defaultdict(int)
    for c in cases:
        line = f"{(case_label(c) if case_label else c):<26}"
        for s in order:
            runs = data.get(s, {}).get(c)
            if not runs:
                line += f"{'—':<16}"
                continue
            votes = [pass_of(r, suite) for r in runs]
            ok = rule_totals(votes, rule)
            totals[s] += ok
            line += f"{('PASS' if ok else 'fail') + f' {sum(votes)}/{len(votes)}':<16}"
        print(line)
    print(f"{'TOTAL':<26}" + "".join(f"{str(totals[s]) + '/' + str(len(cases)):<16}" for s in order))
    return {s: {c: rule_totals([pass_of(r, suite) for r in data[s][c]], rule) for c in data.get(s, {})} for s in order if s in data}


def delta(name, res, a, b):
    if a not in res or b not in res:
        print(f"\n  [{name}] cannot compare {a} vs {b}: not both stored")
        return
    gains = sorted([c for c in res[b] if res[b][c] and not res[a].get(c, False)], key=lambda x: (len(x), x))
    losses = sorted([c for c in res[b] if not res[b][c] and res[a].get(c, False)], key=lambda x: (len(x), x))
    print(f"\n  [{name}] {a} → {b}: +{len(gains)} {gains}  −{len(losses)} {losses}")


def excerpt_index(capture_file):
    """question → list of excerpt lists, in request order (same parser as the manual suite)."""
    p = os.path.join(HERE, capture_file)
    out = defaultdict(list)
    if not os.path.exists(p):
        return out
    for line in open(p, encoding="utf-8"):
        rec = json.loads(line)
        if "chat/completions" not in rec.get("url", ""):
            continue
        body = json.loads(rec["body"])
        user = next((m["content"] for m in body.get("messages", []) if m.get("role") == "user"), "")
        q = user.rsplit("\n\nQuestion: ", 1)[-1].strip() if "\n\nQuestion: " in user else ""
        block = user.split("Manual excerpts:\n\n", 1)[-1].rsplit("\n\nQuestion:", 1)[0]
        ex = []
        for part in block.split("\n\n---\n\n"):
            head, _, txt = part.partition("\n")
            m = re.match(r"\[(\d+)\] \((.+?) — (.+)\)$", head)
            if m:
                ex.append((m.group(2), m.group(3), txt))
        out[q].append(ex)
    return out


print("=" * 100)
print("RECONCILIATION OF THE PUBLISHED TABLES AGAINST THE STORED RUNS (no service calls)")
print("=" * 100)

print("""
PROVENANCE OF EVERY PUBLISHED COLUMN — what was actually run, and on which image
  C0-off  : image prompt-v5-r5, flags off, index kb-pilot-c.  STORED: work-order x3, routing probes.
            NOT stored: frozen, corrected, manual-coverage. The published C0 cells for those three came
            from set C (abc-c, image prompt-v5, SAME index kb-pilot-c, flags did not exist yet).
  D1      : image prompt-v5-r5, intent routing on.  STORED: work-order x3, routing, frozen x3, corrected x3, manual x3.
  D2 / D3 : image prompt-v5-r5, routing + score fusion (alpha 0.5 / 0.7).  D2: all suites. D3: routing, retrieval, frozen, WO.
  D4      : image prompt-v5-r6, intent routing + lexical rescue.  STORED: all suites, capture mounted.
""")

wo = collect(["s4-wo-dump.jsonl", "s4b-wo-dump.jsonl", "s4c-wo-dump.jsonl"], "wo")
woc = collect(["abc-wo-dump.jsonl"], "wo")
res_wo = table("WORK-ORDER 8 x3 — C0 (flags off, r5) vs D1 vs D2 vs D4",
               {**wo, **woc}, ["C-kbpilot", "C0-off", "D1-intent", "D2-hybrid", "D4-rescue"], "wo")
delta("work-order", res_wo, "C0-off", "D1-intent")
delta("work-order", res_wo, "D1-intent", "D4-rescue")
delta("work-order", res_wo, "C0-off", "D4-rescue")

fr = collect(["s4-answers-dump.jsonl", "s4b-answers-dump.jsonl", "s4c-answers-dump.jsonl"], "frozen")
frc = collect(["abc-answers-dump.jsonl"], "frozen")
FR_ORDER = ["C-kbpilot", "D1-intent", "D2-hybrid", "D3-a07", "D4-rescue"]
table("FROZEN 12 x3 — MAJORITY of 3 runs (the rule the suite itself uses, and the rule the published 11/12 came from)",
      {**fr, **frc}, FR_ORDER, "frozen", rule="majority")
res_fr = table("FROZEN 12 x3 — ALL 3 runs required (stricter; the rule the report's text wrongly claimed)",
               {**fr, **frc}, FR_ORDER, "frozen", rule="all")
delta("frozen", res_fr, "C-kbpilot", "D1-intent")
delta("frozen", res_fr, "D1-intent", "D4-rescue")

gen = collect(["s4-generated-dump.jsonl", "s4c-generated-dump.jsonl"], "generated")
genc = collect(["abc-generated-dump.jsonl"], "generated")
GEN_ORDER = ["C-kbpilot", "D1-intent", "D2-hybrid", "D4-rescue"]
table("CORRECTED-CLAIMS 14 x3 — MAJORITY of 3 runs (suite's own rule; source of the published 12/14)",
      {**gen, **genc}, GEN_ORDER, "generated", rule="majority")
res_gen = table("CORRECTED-CLAIMS 14 x3 — ALL 3 runs required",
                {**gen, **genc}, GEN_ORDER, "generated", rule="all")
delta("corrected", res_gen, "C-kbpilot", "D1-intent")
delta("corrected", res_gen, "D1-intent", "D4-rescue")

man = collect(["s4-manuals-dump.jsonl", "s4c-manuals-dump.jsonl"], "manuals")
manc = collect(["abc-manuals-dump.jsonl"], "manuals")
res_man = table("MANUAL-COVERAGE 57 x3 — set C vs D1 vs D2 vs D4 (support recomputed offline where captured)",
                {**man, **manc}, ["C-kbpilot", "D1-intent", "D2-hybrid", "D4-rescue"], "manuals")
delta("manual-coverage", res_man, "C-kbpilot", "D1-intent")
delta("manual-coverage", res_man, "D1-intent", "D4-rescue")

# ── work-order detail: why D1 falls below C0 ────────────────────────────────────────────────
print("\n\n### WORK-ORDER per-run detail (C0 vs D1 vs D4): verdict flags and the five excerpt files")
capt = {"C0-off": excerpt_index("s4-c0-capture.jsonl"), "D1-intent": excerpt_index("s4-d1-capture.jsonl"),
        "D4-rescue": excerpt_index("s4-d4-capture.jsonl")}
used = {k: defaultdict(int) for k in capt}
for case in sorted(wo.get("C0-off", {}), key=lambda x: (len(x), x)):
    print(f"\n-- {case}")
    for s in ["C0-off", "D1-intent", "D4-rescue"]:
        for r in wo.get(s, {}).get(case, []):
            v = r["verdict"]
            q = r.get("question") or ""
            files = ""
            if q and capt[s].get(q):
                i = used[s][q]
                if i < len(capt[s][q]):
                    files = " | ".join(f[:26] for f, _sec, _t in capt[s][q][i])
                used[s][q] = i + 1
            print(f"   {s:<10} run{r['run']} answer={int(bool(v.get('answer')))} cite={int(bool(v.get('citation')))} "
                  f"rule={int(bool(v.get('rule')))}  {str(v.get('why'))[:88]}")
            if files:
                print(f"              excerpts: {files}")

# ── frozen detail: case 05 and any case that changes ────────────────────────────────────────
print("\n\n### FROZEN per-run detail for cases that differ between the sets")
allfr = {**fr, **frc}
for case in sorted({c for s in allfr for c in allfr[s]}, key=lambda x: (len(x), x)):
    verdicts = {s: [pass_of(r, "frozen") for r in allfr[s][case]] for s in allfr if case in allfr[s]}
    if len({tuple(v) for v in verdicts.values()}) == 1:
        continue
    print(f"\n-- case {case}")
    for s in ["C-kbpilot", "D1-intent", "D2-hybrid", "D3-a07", "D4-rescue"]:
        for r in allfr.get(s, {}).get(case, []):
            v = r["verdict"]
            resp = r.get("response") or {}
            top = (resp.get("citations") or [{}])[0]
            print(f"   {s:<11} run{r['run']} answer={int(bool(v.get('answer')))} cite={int(bool(v.get('citation')))} "
                  f"gate={resp.get('gate')} routing={str(resp.get('routing'))[:34]} top={str(top.get('manual'))[:30]} "
                  f"p{top.get('page')} sec={str(top.get('section'))[:40]}")

# ── routing-13: split module-selection from source-presence ─────────────────────────────────
print("\n\n### ROUTING-13 split: module selection vs expected-source-present")
rt = defaultdict(dict)
for f in ["s4-routing-dump.jsonl", "s4b-routing-dump.jsonl", "s4c-routing-dump.jsonl"]:
    for r in rows(f):
        rt[r["set"]][r["case"]] = r
import sys as _sys
_sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "central-assistant-py", "indexer"))
CASES = [
    ("rt-general-01", "technical", "answer", "Technical", ["How work orders are created", "HOW TO CREATE AN UNPLANNED WORK ORDER"], []),
    ("rt-general-02", "technical", "answer", "Technical", ["How work orders are created"], []),
    ("rt-general-03", "technical", "answer", "Technical", ["How work orders are created"], []),
    ("rt-named-01", "technical", "answer", "Technical", ["HOW TO CREATE AN UNPLANNED WORK ORDER"], []),
    ("rt-named-02", "technical", "answer", "Technical", ["Generate Now"], []),
    ("rt-named-03", "technical", "answer", "Technical", ["Generate WO"], []),
    ("rt-pump-01", "technical", "answer", "Technical", ["How work orders are created"], []),
    ("rt-05-ctx-technical", "technical", "answer", "Safety", ["Risk Assessment"], []),
    ("rt-05-no-ctx", None, "answer", "Safety", ["Risk Assessment"], []),
    ("rt-05-ctx-safety", "safety", "answer", "Safety", ["Risk Assessment"], []),
    ("rt-05-explicit-conflict", "technical", None, "Incident", [], []),
    ("rt-ctx-no-override", "technical", "answer", "Incident", ["Near Miss"], []),
    ("rt-explicit-module", "technical", "answer", "Safety", ["Safety Meeting"], []),
]
order = ["C0-off", "D1-intent", "D2-a05", "D2-intent+hybrid", "D3-a07", "D4-rescue"]
present = [s for s in order if s in rt]
print(f"{'case':<26}{'expects':<34}" + "".join(f"{s:<16}" for s in present))
mod_t, src_t, both_t = defaultdict(int), defaultdict(int), defaultdict(int)
n_src = 0
for cid, ctx, exp_gate, exp_mod, must, must_not in CASES:
    has_src = bool(must)
    n_src += has_src
    exp = ("module " + str(exp_mod)) + (" + source" if has_src else " only")
    line = f"{cid:<26}{exp:<34}"
    for s in present:
        r = rt[s].get(cid)
        if not r:
            line += f"{'—':<16}"
            continue
        resp = r.get("response") or {}
        gate, mod = resp.get("gate"), resp.get("module")
        files = [f"{ci.get('manual', '')} — {ci.get('section', '')}" for ci in resp.get("citations", [])]
        ok_gate = exp_gate is None or gate == exp_gate
        ok_mod = exp_mod is None or mod == exp_mod or (gate == "clarify" and exp_mod in (resp.get("candidates") or []))
        module_ok = ok_gate and ok_mod
        src_ok = all(any(m in f for f in files) for m in must) if has_src else None
        mod_t[s] += module_ok
        if has_src and src_ok:
            src_t[s] += 1
        both_t[s] += bool(r.get("ok"))
        cell = ("MOD " + ("Y" if module_ok else "n")) + ("" if src_ok is None else (" SRC " + ("Y" if src_ok else "n")))
        line += f"{cell:<16}"
    print(line)
print(f"{'TOTAL module selection':<60}" + "".join(f"{str(mod_t[s]) + '/13':<16}" for s in present))
print(f"{'TOTAL expected source present':<60}" + "".join(f"{str(src_t[s]) + '/' + str(n_src):<16}" for s in present))
print(f"{'TOTAL published joint':<60}" + "".join(f"{str(both_t[s]) + '/13':<16}" for s in present))
