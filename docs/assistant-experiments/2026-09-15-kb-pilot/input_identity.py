# Which questions received DIFFERENT supplied excerpts between the two arms, and how often the two arms disagree
# on the ones that received IDENTICAL supplied excerpts. The second number is an OBSERVED PASS/FAIL DISAGREEMENT
# ON IDENTICAL SUPPLIED EXCERPTS — it is a property of this paired run, not an accuracy margin, and it is not a
# reason to dismiss any individual failure.
#   python input_identity.py <armA>=<captureA> <armB>=<captureB> <dump.jsonl> [more dumps...]
import json, os, re, sys
from collections import defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import score8

caps = {}
dumps = []
for a in sys.argv[1:]:
    if "=" in a and a.endswith(".jsonl"):
        arm, _, p = a.partition("=")
        caps[arm] = p
        score8.load_captures(arm, os.path.join(HERE, p))
    else:
        dumps.append(a)
A, B = sorted(caps)


def blocks(txt):
    return tuple(re.findall(r"^\[\d+\] \((.+?)\)\s*$", txt, re.M))


qa, qb = score8.CAPS[A], score8.CAPS[B]
qs = sorted(set(qa) | set(qb))
same, diff = [], []
for q in qs:
    a, b = qa.get(q, []), qb.get(q, [])
    (same if (len(a) == len(b) and all(x == y for x, y in zip(a, b))) else diff).append(q)
print(f"questions captured: {A} {len(qa)}  {B} {len(qb)}  union {len(qs)}")
print(f"IDENTICAL supplied excerpts in both arms: {len(same)}")
print(f"DIFFERENT supplied excerpts:              {len(diff)}\n")
for q in diff:
    print(f"DIFFERS: {q[:150]}")
    a, b = qa.get(q, []), qb.get(q, [])
    if a and b:
        ta, tb = set(blocks(a[0])), set(blocks(b[0]))
        for t in sorted(ta - tb):
            print(f"     only {A}: {t[:150]}")
        for t in sorted(tb - ta):
            print(f"     only {B}: {t[:150]}")
        if not (ta - tb) and not (tb - ta):
            print("     same excerpt headers; the text inside differs")

rows = defaultdict(lambda: defaultdict(dict))
qof = {}
for p in dumps:
    for line in open(os.path.join(HERE, p), encoding="utf-8"):
        if not line.strip():
            continue
        r = json.loads(line)
        s = r.get("suite", "answers")
        if s == "routing":
            continue
        key = (s, str(r["case"]))
        qof[key] = score8.spec(r)[5]
        rows[key][r["set"]][r.get("run", 1)] = score8.verdict(r)["pass"]

n = d = 0
detail = []
for key, arms in rows.items():
    if qof[key] in diff:
        continue
    for run in sorted(arms.get(A, {})):
        if run in arms.get(B, {}):
            n += 1
            if arms[A][run] != arms[B][run]:
                d += 1
                detail.append((key, run, arms[A][run], arms[B][run]))
print(f"\n== observed pass/fail disagreement on identical supplied excerpts ==")
print(f"paired runs compared: {n}")
print(f"runs where the two arms disagree: {d}  ({100*d/n:.1f}% of those runs)")
print("This is a property of this run, not an accuracy margin, and not a reason to dismiss a specific failure.")
for key, run, a, b in sorted(detail):
    print(f"   {key[0]:<10} {key[1]:<18} run {run}: {A}={a} {B}={b}")
