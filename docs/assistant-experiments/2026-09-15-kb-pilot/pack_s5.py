# Build the FULL evidence pack for the final run (owner/reviewer request, 18-Sep): complete stored answers together with
# the complete captured model inputs, for every case a reviewer asked to see. No service or model calls — the dumps and the
# captures are read from disk. Each block shows: the case and its judging rule, the automatic verdict, every supplied
# excerpt in full, and the whole answer text, for each of the three arms.
#   python pack_s5.py
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
IDX = os.path.join(HERE, "..", "..", "..", "central-assistant-py", "indexer")
sys.path.insert(0, IDX)

ARMS = ["B0", "D5a", "D5"]
CAP = {a: os.path.join(HERE, f"s5-{a.lower()}-capture.jsonl") for a in ARMS}


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


def rows_of(dump):
    out = defaultdict(lambda: defaultdict(dict))
    for line in open(os.path.join(HERE, dump), encoding="utf-8"):
        if line.strip():
            r = json.loads(line)
            out[str(r["case"])][r["set"]][r["run"]] = r
    return out


def emit(out, title, dump, wanted, rule_of, question_of):
    data = rows_of(dump)
    for case in wanted:
        case = str(case)
        if case not in data:
            continue
        out.write("\n" + "#" * 118 + f"\n{title} — CASE {case}\n")
        out.write(f"QUESTION: {question_of(case)}\n")
        out.write(f"JUDGING RULE: {rule_of(case)}\n")
        for arm in ARMS:
            for run in sorted(data[case].get(arm, {})):
                r = data[case][arm][run]
                resp = r["response"]
                out.write("\n" + "=" * 110 + f"\n[{arm}] run {run} — automatic verdict: {r['verdict']}\n")
                out.write("CITATIONS SHOWN TO THE USER:\n")
                for i, c in enumerate(resp.get("citations") or [], 1):
                    out.write(f"  [{i}] {c.get('manual')} — {c.get('section')}\n")
                ex = excerpts_for(arm, question_of(case))
                out.write("\nCAPTURED MODEL INPUT (the excerpts exactly as sent):\n")
                out.write((re.sub(r"[ \t]+", " ", ex) if ex else "  (capture not matched)") + "\n")
                out.write(f"\nFULL ANSWER:\n{resp.get('response')}\n")


def main():
    import acceptance_generated as G
    import acceptance_answers as A
    import acceptance_wo as W
    manual = {c["id"]: c for c in json.load(open(os.path.join(IDX, "manual_cases.json"), encoding="utf-8"))}
    fresh = {c["id"]: c for c in json.load(open(os.path.join(IDX, "fresh_cases.json"), encoding="utf-8"))["cases"]}

    with open(os.path.join(HERE, "s5-evidence-pack.txt"), "w", encoding="utf-8") as out:
        out.write("FULL ANSWERS AND CAPTURED INPUTS — final run (B0 baseline / D5a routing+guarded rescue on v5 / D5 same on v6)\n"
                  "Built from the stored dumps and captures only; no service or model calls.\n")

        # corrected-claims: the cases that differ between arms, plus the two that fail everywhere
        emit(out, "CORRECTED CLAIMS", "s5-generated-dump.jsonl", [1, 4, 6, 7],
             rule_of=lambda c: (f"must contain {G.CASES[int(c) - 1][5]}; must NOT contain {G.CASES[int(c) - 1][6]}; "
                                f"expected manual substring {G.CASES[int(c) - 1][3]!r}, pages {G.CASES[int(c) - 1][4]}. "
                                f"Source note: {G.CASES[int(c) - 1][7]}"),
             question_of=lambda c: G.CASES[int(c) - 1][1])

        # work-order: every case not passing on every arm
        wo_cases = [c[0] for c in W.CASES] + [p[0] for p in W.PHRASINGS]
        emit(out, "WORK ORDER", "s5-wo-dump.jsonl", ["wo-generic-02", "wo-phr-04"],
             rule_of=lambda c: "judge .11 — see acceptance_wo.py: the answer must describe automatic generation and pair each action with its own conditions",
             question_of=lambda c: next((x[1] for x in W.CASES if x[0] == c), None) or next(p[1] for p in W.PHRASINGS if p[0] == c))

        # manual coverage: every case that changed between arms
        emit(out, "MANUAL COVERAGE", "s5-manuals-dump.jsonl",
             ["crewing-1", "fn-1", "fs-ves-1", "nm-3", "pmsoffice-1", "pmsoffice-2", "pmsvessel-1", "crewing-2", "pmsvessel-2"],
             rule_of=lambda c: f"must {manual[c]['must']}; must_not {manual[c]['must_not']}; expected {manual[c]['file']} p{manual[c]['pages']}. Evidence: {manual[c]['evidence']}",
             question_of=lambda c: manual[c]["question"])

        # fresh validation: all ten, all arms
        emit(out, "FRESH VALIDATION", "s5-fresh-dump.jsonl", list(fresh),
             rule_of=lambda c: f"SCORE_BY: {fresh[c]['score_by']} | must {fresh[c]['must']}; must_not {fresh[c]['must_not']}; expected_module {fresh[c].get('expected_module')}",
             question_of=lambda c: fresh[c]["question"])

    size = os.path.getsize(os.path.join(HERE, "s5-evidence-pack.txt"))
    print(f"wrote s5-evidence-pack.txt: {size // 1024} KB")


main()
