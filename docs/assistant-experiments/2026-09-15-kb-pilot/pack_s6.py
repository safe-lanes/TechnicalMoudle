# Full answers + captured model inputs for the S6 paired run (E0 = pre-correction index kb-pilot-c,
# E1 = corrected document index kb-pilot-d; everything else identical). Reads the stored dumps and the captures
# from disk — no service or model calls. Cases are selected automatically: every case whose verdict differs
# between the two arms under the current judges, plus any case named on the command line.
#   python pack_s6.py [extra-case-id ...]
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
IDX = os.path.join(HERE, "..", "..", "..", "central-assistant-py", "indexer")
sys.path.insert(0, IDX)
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "central-assistant-py"))
sys.path.insert(0, HERE)

import acceptance_answers as A      # noqa: E402
import acceptance_generated as G    # noqa: E402
import acceptance_wo as W           # noqa: E402

ARMS = ["E0", "E1"]
CAP = {a: os.path.join(HERE, "..", "..", "..", "..", "s6-captures", a.lower(), "capture.jsonl") for a in ARMS}
CAP = {a: os.path.join(HERE, f"s6-{a.lower()}-capture.jsonl") for a in ARMS}
MANUALS = {c["id"]: c for c in json.load(open(os.path.join(IDX, "manual_cases.json"), encoding="utf-8"))}
FRESH = {c["id"]: c for c in json.load(open(os.path.join(IDX, "fresh_cases.json"), encoding="utf-8"))["cases"]}


def captures(path):
    out = defaultdict(list)
    if not os.path.exists(path):
        return out
    for line in open(path, encoding="utf-8"):
        rec = json.loads(line)
        if "chat/completions" not in rec.get("url", ""):
            continue
        body = json.loads(rec["body"])
        user = next((m["content"] for m in body.get("messages", []) if m.get("role") == "user"), "")
        q = user.rsplit("\n\nQuestion: ", 1)[-1].strip() if "\n\nQuestion: " in user else ""
        out[q].append(user.split("Manual excerpts:\n\n", 1)[-1].rsplit("\n\nQuestion:", 1)[0])
    return out


CAPS = {a: captures(p) for a, p in CAP.items()}
USED = {a: defaultdict(int) for a in ARMS}


def excerpts_for(arm, question):
    lst = CAPS[arm].get(question) or []
    i = USED[arm][question]
    USED[arm][question] = i + 1
    return lst[i] if i < len(lst) else None


def rule_and_question(suite, case):
    if suite == "manuals":
        c = MANUALS[case]
        return (f"must {c['must']}; must_not {c['must_not']}; expected {c['file']} p{c['pages']}. "
                f"Evidence: {c['evidence']}"), c["question"]
    if suite == "generated":
        cls, q, module, manual, page, must, must_not, src = G.CASES[int(case) - 1]
        return f"must {must}; must_not {must_not}; expected manual {manual!r} pages {page}. Source: {src}", q
    if suite == "wo":
        spec = {c[0]: c for c in W.CASES}
        q = spec[case][1] if case in spec else next(p[1] for p in W.PHRASINGS if p[0] == case)
        return f"work-order judge .{W.JUDGE_VERSION}, rule in acceptance_wo.py", q
    if suite == "fresh":
        c = FRESH[case]
        return f"SCORE_BY: {c['score_by']} | must {c['must']}; must_not {c['must_not']}; expected_module {c.get('expected_module')}", c["question"]
    cls, q, module, manual, page, must, must_not, src = A.CASES[int(case) - 1]
    return f"must {must}; must_not {must_not}; expected {manual!r} p{page}. Source: {src}", q


def main():
    extra = set(sys.argv[1:])
    import score7
    rows = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    for name in ("answers", "generated", "wo", "manuals", "fresh"):
        p = os.path.join(HERE, f"s6-{name}-dump.jsonl")
        if not os.path.exists(p):
            continue
        for line in open(p, encoding="utf-8"):
            if line.strip():
                r = json.loads(line)
                rows[r.get("suite", "answers")][str(r["case"])][r["set"]][r["run"]] = r

    out = open(os.path.join(HERE, "s6-evidence-pack.txt"), "w", encoding="utf-8")
    out.write("FULL ANSWERS AND CAPTURED INPUTS — S6 paired run\n"
              "E0 = v5 candidate on kb-pilot-c (pre-correction) · E1 = identical, on kb-pilot-d (corrected document)\n"
              "Built from the stored dumps and captures only; no service or model calls.\n")
    n = 0
    for suite in rows:
        for case in sorted(rows[suite]):
            v = {a: [score7.verdict(r)[0] for _, r in sorted(rows[suite][case].get(a, {}).items())] for a in ARMS}
            differs = v["E0"] != v["E1"]
            if not differs and case not in extra:
                continue
            n += 1
            rule, question = rule_and_question(suite, case)
            out.write("\n" + "#" * 118 + f"\n{suite.upper()} — CASE {case}\nQUESTION: {question}\nJUDGING RULE: {rule}\n"
                      f"PER-RUN (current judges): E0 {v['E0']}  E1 {v['E1']}\n")
            for arm in ARMS:
                for run, r in sorted(rows[suite][case].get(arm, {}).items()):
                    resp = r["response"]
                    ok = score7.verdict(r)
                    out.write("\n" + "=" * 110 + f"\n[{arm}] run {run} — verdict {ok[0]} — {ok[1]}\n")
                    out.write("CITATIONS SHOWN TO THE USER:\n")
                    for i, c in enumerate(resp.get("citations") or [], 1):
                        out.write(f"  [{i}] {c.get('manual')} — {c.get('section')}\n")
                    ex = excerpts_for(arm, question)
                    out.write("\nCAPTURED MODEL INPUT (the excerpts exactly as sent):\n")
                    out.write((re.sub(r"[ \t]+", " ", ex) if ex else "  (capture not matched)") + "\n")
                    out.write(f"\nFULL ANSWER:\n{resp.get('response')}\n")
    out.close()
    print(f"wrote s6-evidence-pack.txt: {n} cases, {os.path.getsize(os.path.join(HERE, 's6-evidence-pack.txt')) // 1024} KB")


main()
