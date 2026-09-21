# Claim-level citation review — does the SUPPLIED text actually support what the answer says?
#
# The citation check in judge .9 only proves a cited document was supplied and carries a required phrase
# (necessary, not sufficient). This goes claim by claim. No model calls: stored dumps + captured inputs only.
#
# Method (deterministic, so it can be re-run and audited):
#   1. Take the answer body, drop the Source/citation block.
#   2. Split it into CLAIMS: numbered steps, bullets, and sentences.
#   3. Classify each claim:
#        source-commentary  — a statement ABOUT the sources ("the June manuals do not mention X"). Reported
#                             separately; it is not a procedural claim and is not scored for support here.
#        navigational       — pure UI navigation with no factual condition ("Open the Work Orders screen").
#        substantive        — everything else: conditions, rules, permissions, outcomes.
#   4. For each substantive claim, find the supplied excerpt with the highest content-word coverage
#        coverage = |claim terms that appear in that excerpt| / |claim terms|
#      and label: supported >= 0.80 · partial 0.50-0.79 · UNSUPPORTED < 0.50.
#
# The thresholds route attention; they are not the verdict. Every claim below the bar is printed in full with
# its best-matching excerpt so it can be READ, which is what makes this a source-based review.
#
#   python claim_review.py <arm> [more arms...]        e.g. python claim_review.py F1 F0
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import score8                      # noqa: E402
import acceptance_answers as A     # noqa: E402

SUITES = ("answers", "fresh", "generated", "manuals", "wo")
SOURCE_LINE = re.compile(r"^\s*(\*\*)?(source|sources)\b", re.I)
META = re.compile(r"\b(manual|manuals|excerpt|excerpts|documentation|guidance|draft|provenance|revision|"
                  r"code-derived|not mention|do(es)? not (mention|state|describe|cover)|recorded in|"
                  r"comes? from|according to|the june)\b", re.I)
NAV = re.compile(r"^\s*(open|go to|click|select|navigate|choose|press|enter)\b[^.]{0,80}$", re.I)


def claims_of(answer: str) -> list[str]:
    body, out = [], []
    for ln in answer.splitlines():
        if SOURCE_LINE.match(ln.strip().lstrip("-* ")):
            break
        body.append(ln)
    for ln in "\n".join(body).splitlines():
        t = re.sub(r"^\s*(\d+\.|[-*•]|\d+\.\d+\.?)\s*", "", ln).strip()
        if not t:
            continue
        for s in re.split(r"(?<=[.!?])\s+", t):
            s = A.md_plain(s).strip()
            if len(s) > 15:
                out.append(s)
    return out


def kind(c: str) -> str:
    # a line that ends in ':' introduces the list under it — the content is in those items, which are scored
    # separately. Scoring the lead-in as a claim padded the first run of this review with 30-odd artefacts.
    if c.rstrip().endswith(":") or len(c.split()) < 5:
        return "lead-in"
    if META.search(c):
        return "source-commentary"
    if NAV.match(c.rstrip(".")):
        return "navigational"
    return "substantive"


def review(arm: str):
    rows = []
    for s in SUITES:
        p = os.path.join(HERE, f"s7-{s}-dump.jsonl")
        if os.path.exists(p):
            rows += [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]
    rows = [r for r in rows if r["set"] == arm]
    tally = defaultdict(int)
    flagged = []
    for r in rows:
        manual, pages, must, must_not, cls, q, _ = score8.spec(r)
        sup = score8.supplied_for(arm, q, r.get("run", 1))
        blocks = A.supplied_blocks(sup)
        if not blocks:
            tally["no-capture"] += 1
            continue
        ex_terms = [(b, A.content_terms_of(b["text"] + " " + b["section"])) for b in blocks]
        for c in claims_of(r["response"].get("response") or ""):
            k = kind(c)
            tally[k] += 1
            if k != "substantive":
                continue
            ct = {t for t in A.content_terms_of(c) if len(t) > 2}
            if len(ct) < 3:
                tally["too-short-to-score"] += 1
                continue
            best, best_terms, cov = None, set(), 0.0
            for b, et in ex_terms:
                v = len(ct & et) / len(ct)
                if v > cov:
                    best, best_terms, cov = b, et, v
            label = "supported" if cov >= 0.80 else ("partial" if cov >= 0.50 else "UNSUPPORTED")
            tally[label] += 1
            if label != "supported":
                flagged.append({"suite": r.get("suite", "answers"), "case": str(r["case"]), "run": r.get("run", 1),
                                "claim": c, "coverage": round(cov, 2), "label": label,
                                "best_doc": best["document"] if best else None,
                                "best_sec": best["section"] if best else None,
                                "missing": sorted(ct - best_terms)[:12],
                                "best_text": re.sub(r"\s+", " ", best["text"])[:600] if best else ""})
    return tally, flagged


def main():
    arms = sys.argv[1:] or ["F1"]
    for arm in arms:
        score8.load_captures(arm, os.path.join(HERE, f"s7-{arm.lower()}-capture.jsonl"))
    for arm in arms:
        tally, flagged = review(arm)
        tot = tally["supported"] + tally["partial"] + tally["UNSUPPORTED"]
        print("=" * 112)
        print(f"ARM {arm} — claim-level review of every stored answer against its captured excerpts")
        print("=" * 112)
        print(f"  substantive claims scored : {tot}")
        print(f"     supported   (>=0.80)   : {tally['supported']}")
        print(f"     partial     (0.50-0.79): {tally['partial']}")
        print(f"     UNSUPPORTED (<0.50)    : {tally['UNSUPPORTED']}")
        print(f"  source-commentary (reported, not scored for support): {tally['source-commentary']}")
        print(f"  navigational (no factual condition)                 : {tally['navigational']}")
        print(f"  too short to score                                  : {tally['too-short-to-score']}")
        uns = [f for f in flagged if f["label"] == "UNSUPPORTED"]
        # group identical claims so the same sentence across runs is read once
        groups = defaultdict(list)
        for f in uns:
            groups[re.sub(r"\W+", " ", f["claim"].lower()).strip()].append(f)
        print(f"\n  UNSUPPORTED claims: {len(uns)} occurrences in {len(groups)} distinct sentences — all printed below\n")
        for g in sorted(groups.values(), key=lambda x: -len(x)):
            f = g[0]
            where = ", ".join(sorted({f'{x["suite"]}/{x["case"]} r{x["run"]}' for x in g}))
            print("-" * 112)
            print(f"[{len(g)}x] coverage {f['coverage']:.2f}   {where}")
            print(f"  CLAIM: {f['claim']}")
            print(f"  terms not found in any supplied excerpt: {f['missing']}")
            print(f"  closest supplied excerpt: {f['best_doc']} — {f['best_sec']}")
            print(f"     {f['best_text'][:400]}")
        print()


main()
