# Instrument audit — run BEFORE quoting any number from this experiment.
# Standing rule (Ghazi, 21-Sep-2026): a checker that cannot fail is not evidence. Six findings in this
# workstream were wrong because the tool that produced the number was never tested. Each check below
# includes a case the instrument must REJECT.
#
#   python verify_instruments.py
import json
import sys

import analyse as A
import analyse_answers as AA

R = json.load(open("answers.json", encoding="utf-8"))["results"]
r6c = [r for label, r in A.RULES if label.startswith("R6c")][0]
tested = sorted({r["id"] for r in R})
case_of = {c["id"]: c for c in A.CAND["cases"]}
fails = []


def check(name, got, exp):
    ok = got == exp
    print(f"   {'PASS' if ok else 'FAIL'}  {name:<46} got {got!r}")
    if not ok:
        fails.append(name)


print("1. cite_module_ok — must detect a mislabel, not just agree")
check("correct label", AA.cite_module_ok({"module": "Audit", "manual": "Audit - History Manual_R1"}), True)
check("MISLABELLED (the actual bug)", AA.cite_module_ok({"module": "Technical", "manual": "Audit - History Manual_R1"}), False)
check("unknown manual prefix is not judged", AA.cite_module_ok({"module": "Audit", "manual": "Odd.pdf"}), None)

print("\n2. supplied_expected — must separate right PAGE from merely right FILE")
c = {"expected_file": "Audit - History Manual_R1_30.06.2026.pdf", "expected_pages": [16]}
f = "Audit - History Manual_R1_30.06.2026.pdf"
check("right file and page", A.supplied_expected([{"file": f, "page": "16"}], c), (True, True))
check("right file, WRONG page", A.supplied_expected([{"file": f, "page": "9"}], c), (True, False))
check("different file", A.supplied_expected([{"file": "Technical - PMS User Manual.pdf", "page": "16"}], c), (False, False))

print("\n3. the offline route() reproduction vs the LIVE baseline container")
mism = [cid for cid in tested
        if {(r["module"] or "").lower() for r in R if r["id"] == cid and r["arm"] == "baseline"}
        != {A.run_rule(case_of[cid], A.RULES[0][1])[2]}]
check(f"module matches live on all {len(tested)} tested questions", mism, [])

print("\n4. the offline excerpt model vs BOTH live containers")
bad = []
for cid in tested:
    pb, pc = len(A.run_rule(case_of[cid], A.RULES[0][1])[1]), len(A.run_rule(case_of[cid], r6c)[1])
    lb = {len(r["citations"] or []) for r in R if r["id"] == cid and r["arm"] == "baseline"}
    lc = {len(r["citations"] or []) for r in R if r["id"] == cid and r["arm"] == "candidate"}
    if lb != {pb} or lc != {pc}:
        bad.append(cid)
check(f"excerpt counts match live on all {len(tested)}, both arms", bad, [])

print("\n" + ("ALL INSTRUMENTS VERIFIED" if not fails else f"BROKEN: {fails}"))
sys.exit(1 if fails else 0)
