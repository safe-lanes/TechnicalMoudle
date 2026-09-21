# Review ledger — every claim in every stored answer, with a STABLE ID and an evidence bundle.
#
# Replaces claim_review.py's screening-only output. Differences, all from the reviewer's direction of 19-Sep:
#   * stable id  {suite}/{case}/{arm}/r{run}/c{nn}   nn = position among ALL extracted sentences, so the id does
#     not move when classification changes.
#   * NOTHING is excluded for being short or ending in a colon. "Sail Admin only" is a claim.
#   * a sentence about a source is still a claim when it asserts a fact ("the manual says X", "these procedures
#     are the same", "the switch does not apply"). Only pure provenance boilerplate is set aside.
#   * navigation is scored when choosing the wrong screen/module/action would change the procedure.
#   * risk categories are tagged so the high-coverage band can be reviewed where it matters.
#   * evidence bundle: the top-3 supplied passages with document / section / page and the best-matching sentence
#     inside each, so a verdict can be recorded against real text.
#
# Verdicts live in review-verdicts.json, keyed by claim id: {"verdict": supported|contradicted|unsupported|
# unresolved, "why": "...", "evidence": "doc — section (p.N): quote"}. Nothing here assigns a verdict; this
# builds the population and the evidence. No model calls.
#
#   python ledger.py build   F1 F0      # writes ledger.json + ledger-<arm>.txt
#   python ledger.py stats              # population counts and the review plan
import json
import os
import random
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import score8                      # noqa: E402
import acceptance_answers as A     # noqa: E402

SUITES = ("answers", "fresh", "generated", "manuals", "wo")
SOURCE_LINE = re.compile(r"^\s*(\*\*)?(source|sources)\b", re.I)

# pure provenance boilerplate — asserts nothing about the product
BOILERPLATE = re.compile(r"^\s*(provenance note|these details come from|the role and switch details come from"
                         r"|this (information|guidance) (is|comes)|draft code-derived guidance)", re.I)
# a sentence about a source that nevertheless asserts a fact
SOURCE_FACTUAL = re.compile(r"\b(says?|states?|documents?|describes?|shows?|specif(y|ies)|confirms?|"
                            r"does not (mention|state|describe|cover|document)|do not (mention|state|describe|cover)|"
                            r"only defines?|the same|differs?|different)\b", re.I)

CATS = {
    "permission": r"\b(only|allowed|permitted|restrict\w*|role|sail admin|pms admin|head of dept|office user|"
                  r"vessel admin|may|can(not)?|unable|rights?)\b",
    "prerequisite": r"\b(must|require\w*|need(s|ed)?|prerequisite|before|enabled?|switch|only if|only when|"
                    r"provided that|as long as)\b",
    "negation": r"\b(not|no|never|without|cannot|can't|n't|except|exempt|neither|nor)\b",
    "number-limit": r"(\b\d+\s*(mb|kb|gb|days?|hours?|minutes?|%)\b|\b\d{2,}\b|\bmaximum\b|\bat most\b|\blimit\b)",
    "exclusivity": r"\b(only|solely|exclusively|just the|nothing else|both|either|all three|the other)\b",
    "comparison": r"\b(same|differs?|different|both|also appl\w+|separate|rather than|whereas|while|unlike|"
                  r"instead|as well as|by contrast)\b",
}
NAV_WORD = r"^\s*(open|go to|click|select|navigate|choose|press|enter|use)\b"
# navigation matters when it names a screen, module, tab or action — the wrong one changes the procedure
NAV_CRITICAL = r"\b(module|sub-module|sub-submodule|screen|tab|page|dashboard|admin|settings|part [a-e]\b|" \
               r"components?|work orders?|spares?|stores?|crewing|safety|audit|incident|technical)\b"


def sentences_of(answer: str) -> list[str]:
    body = []
    for ln in answer.splitlines():
        if SOURCE_LINE.match(ln.strip().lstrip("-* ")):
            break
        body.append(ln)
    out = []
    for ln in "\n".join(body).splitlines():
        t = re.sub(r"^\s*(\d+\.|[-*•]|\d+\.\d+\.?)\s*", "", ln).strip()
        if not t:
            continue
        for s in re.split(r"(?<=[.!?])\s+", t):
            s = A.md_plain(s).strip()
            if s:
                out.append(s)
    return out


def classify(s: str) -> tuple[str, list[str]]:
    cats = [k for k, pat in CATS.items() if re.search(pat, s, re.I)]
    if BOILERPLATE.match(s):
        return "provenance-boilerplate", cats
    if re.match(NAV_WORD, s, re.I) and not re.search(r"\b(must|require|only|cannot|not)\b", s, re.I):
        return ("navigation-critical" if re.search(NAV_CRITICAL, s, re.I) else "navigation-plain"), cats
    if len(s.split()) < 3 and not cats:
        return "fragment", cats
    if SOURCE_FACTUAL.search(s) and re.search(r"\b(manual|excerpt|documentation|guidance|notes?)\b", s, re.I):
        return "source-factual", cats          # a claim ABOUT a source that asserts something — reviewed
    return "substantive", cats


def best_passages(claim: str, blocks: list[dict], k: int = 3):
    ct = {t for t in A.content_terms_of(claim) if len(t) > 2}
    scored = []
    for b in blocks:
        et = A.content_terms_of(b["text"] + " " + b["section"])
        cov = len(ct & et) / len(ct) if ct else 0.0
        sents = re.split(r"(?<=[.!?])\s+|\n+", b["text"])
        best_s, bs = "", 0.0
        for s in sents:
            st = A.content_terms_of(s)
            v = len(ct & st) / len(ct) if ct else 0.0
            if v > bs:
                best_s, bs = s.strip(), v
        scored.append({"doc": b["document"], "section": b["section"], "page": b["page"],
                       "coverage": round(cov, 2), "best_sentence": re.sub(r"\s+", " ", best_s)[:400],
                       "sentence_coverage": round(bs, 2)})
    scored.sort(key=lambda x: -x["coverage"])
    return ct, scored[:k]


def build(arms):
    for a in arms:
        score8.load_captures(a, os.path.join(HERE, f"s7-{a.lower()}-capture.jsonl"))
    rows = []
    for s in SUITES:
        p = os.path.join(HERE, f"s7-{s}-dump.jsonl")
        if os.path.exists(p):
            rows += [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]
    out = []
    for r in rows:
        arm = r["set"]
        if arm not in arms:
            continue
        suite = r.get("suite", "answers")
        manual, pages, must, must_not, cls, q, _ = score8.spec(r)
        sup = score8.supplied_for(arm, q, r.get("run", 1))
        blocks = A.supplied_blocks(sup)
        for i, s in enumerate(sentences_of(r["response"].get("response") or ""), 1):
            kind, cats = classify(s)
            ct, tops = best_passages(s, blocks) if blocks else (set(), [])
            cov = tops[0]["coverage"] if tops else 0.0
            out.append({
                "id": f"{suite}/{r['case']}/{arm}/r{r.get('run', 1)}/c{i:02d}",
                "suite": suite, "case": str(r["case"]), "arm": arm, "run": r.get("run", 1), "n": i,
                "question": q, "claim": s, "kind": kind, "categories": cats,
                "coverage": round(cov, 2),
                "band": "high" if cov >= 0.80 else ("partial" if cov >= 0.50 else "low"),
                "evidence": tops, "n_supplied": len(blocks),
            })
    json.dump(out, open(os.path.join(HERE, "ledger.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"ledger.json: {len(out)} claims across {len(arms)} arm(s)")
    return out


REVIEWABLE = ("substantive", "source-factual", "navigation-critical")
RISK = ("permission", "prerequisite", "negation", "number-limit", "exclusivity")


def population(led, arm="F1"):
    """The review population the reviewer defined, as disjoint groups."""
    mine = [c for c in led if c["arm"] == arm and c["kind"] in REVIEWABLE]
    low = [c for c in mine if c["band"] == "low"]
    partial = [c for c in mine if c["band"] == "partial"]
    high = [c for c in mine if c["band"] == "high"]
    high_risk = [c for c in high if set(c["categories"]) & set(RISK)]
    high_rest = [c for c in high if not set(c["categories"]) & set(RISK)]
    rng = random.Random(20260919)                      # fixed seed → reproducible sample
    n = max(30, round(0.20 * len(high_rest)))
    sample = sorted(rng.sample(high_rest, min(n, len(high_rest))), key=lambda c: c["id"])
    return {"low": low, "partial": partial, "high_risk": high_risk,
            "high_rest": high_rest, "high_sample": sample}


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "stats"
    if cmd == "build":
        build(sys.argv[2:] or ["F1", "F0"])
        return
    led = json.load(open(os.path.join(HERE, "ledger.json"), encoding="utf-8"))
    for arm in ("F1", "F0"):
        if not any(c["arm"] == arm for c in led):
            continue
        p = population(led, arm)
        byk = defaultdict(int)
        for c in led:
            if c["arm"] == arm:
                byk[c["kind"]] += 1
        print(f"\n=== ARM {arm} — extracted {sum(byk.values())} sentences")
        for k, v in sorted(byk.items(), key=lambda x: -x[1]):
            print(f"    {v:>5}  {k}{'   [reviewable]' if k in REVIEWABLE else ''}")
        print(f"  REVIEW POPULATION (reviewable kinds only):")
        print(f"    low     (<0.50)      {len(p['low']):>5}   all reviewed")
        print(f"    partial (0.50-0.79)  {len(p['partial']):>5}   all reviewed")
        print(f"    high    (>=0.80)     {len(p['high_risk']) + len(p['high_rest']):>5}")
        print(f"       of which risk categories {len(p['high_risk']):>5}   all reviewed")
        print(f"       remainder                {len(p['high_rest']):>5}   sample {len(p['high_sample'])} "
              f"({100 * len(p['high_sample']) / max(1, len(p['high_rest'])):.0f}%), seed 20260919")
        tot = len(p['low']) + len(p['partial']) + len(p['high_risk']) + len(p['high_sample'])
        print(f"    TO REVIEW            {tot:>5}")


main()
