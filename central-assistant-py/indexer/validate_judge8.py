"""Validate base judge .8 on STORED answers only — no service calls, no model calls, nothing rewritten.

Three parts:

  A  .7 → .8 verdict changes over every stored dump, each with the reason. Captures are used where they exist
     (the two runs that recorded them); where they do not, the .8 support and missing-evidence tests cannot be
     decided and the run is reported as REVIEW-NEEDED rather than silently passed or failed.
  B  negative controls built from real stored answers — wrong document, wrong section/page, and a citation to a
     document whose text was never supplied. These are FIXTURES: they show what the rule rejects, not that the
     situation occurs in production.
  C  every sentence in every stored answer that asserts a missing-evidence phrase, with the .7 class, the .8 class
     and the supplied-excerpt test behind it.

  python indexer/validate_judge8.py --captures ARM=path ... <dump.jsonl> [more dumps...]
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import acceptance_answers as A  # noqa: E402
import acceptance_generated as G  # noqa: E402

MANUAL_CASES = {c["id"]: c for c in json.loads(Path(__file__).with_name("manual_cases.json").read_text(encoding="utf-8"))}
CAPS: dict[str, dict[str, list[str]]] = {}


def load_captures(arm: str, path: str):
    out = defaultdict(list)
    for line in open(path, encoding="utf-8"):
        rec = json.loads(line)
        if "chat/completions" not in rec.get("url", ""):
            continue
        user = next((m["content"] for m in json.loads(rec["body"]).get("messages", []) if m.get("role") == "user"), "")
        if "\n\nQuestion: " in user:
            out[user.rsplit("\n\nQuestion: ", 1)[-1].strip()].append(
                user.split("Manual excerpts:\n\n", 1)[-1].rsplit("\n\nQuestion:", 1)[0])
    CAPS[arm] = out


def spec(row):
    suite, case = row.get("suite"), str(row["case"])
    if suite == "manuals":
        c = MANUAL_CASES[case]
        return c["file"].rsplit(".", 1)[0], c["pages"], c["must"], c["must_not"] + A.NOT_COVERED, "gen", c["question"], None
    if suite == "generated":
        cls, q, _m, manual, page, must, must_not, _s = G.CASES[int(case) - 1]
        return manual, page, must, must_not, cls, q, G.SCOPED_MUST.get(int(case))
    cls, q, _m, manual, page, must, must_not, _s = A.CASES[int(case) - 1]
    return manual, page, must, must_not, cls, q, None


def supplied_for(row, question):
    lst = (CAPS.get(row["set"]) or {}).get(question) or []
    r = row.get("run", 1)
    return lst[r - 1] if 0 < r <= len(lst) else None


def set_flags(v8: bool):
    A.JUDGE_CITE_EXACT = A.JUDGE_EVIDENCE_CHECK = A.JUDGE_PHRASE_EQUIV = v8


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--captures", action="append", default=[], metavar="ARM=PATH")
    ap.add_argument("dumps", nargs="+")
    args = ap.parse_args()
    for c in args.captures:
        arm, _, p = c.partition("=")
        load_captures(arm, p)

    rows = []
    for path in args.dumps:
        for line in open(path, encoding="utf-8"):
            if line.strip():
                r = json.loads(line)
                if r.get("suite") in (None, "answers", "generated", "manuals"):
                    r["_dump"] = Path(path).name.split("-")[0]
                    rows.append(r)

    print(f"== A. judge .7 → .8 on {len(rows)} stored runs "
          f"({sum(1 for r in rows if supplied_for(r, spec(r)[5]))} with a captured model input)\n")
    changed = []
    reviews = []
    for r in rows:
        manual, pages, must, must_not, cls, q, scoped = spec(r)
        sup = supplied_for(r, q)
        set_flags(False)
        old = A.judge_ex(r["response"], manual, pages, must, must_not, cls)
        set_flags(True)
        new = A.judge_ex(r["response"], manual, pages, must, must_not, cls, supplied=sup, scoped_must=scoped)
        key = (r["_dump"], r.get("suite", "answers"), r["set"], str(r["case"]), r.get("run", 1))
        if (old["answer"], old["citation"], old["attribution"]) != (new["answer"], new["citation"], new["attribution"]):
            why = []
            if old["citation"] != new["citation"]:
                why.append(f"citation {old['citation']}→{new['citation']} (support={new['support']}, "
                           f"first-source={new['cite_first']})")
            if old["answer"] != new["answer"]:
                why.append(f"answer {old['answer']}→{new['answer']}"
                           + (f" scope_fail={new['scope_fail']}" if new["scope_fail"] else "")
                           + (f" decline={new['decline']}" if new["decline"] else ""))
            if old["attribution"] != new["attribution"]:
                why.append(f"attribution {old['attribution']}→{new['attribution']}")
            changed.append((key, "; ".join(why)))
        for rv in new["review"]:
            reviews.append((key, rv))
    for k, why in changed:
        print(f"  CHANGED {k[0]:<6} {k[1]:<10} {k[2]:<14} case {k[3]:<18} run {k[4]}: {why}")
    print(f"\n  total changed verdicts: {len(changed)}")
    byr = defaultdict(int)
    for _k, rv in reviews:
        byr[rv.split("(")[0].split("→")[0].strip()] += 1
    print(f"  review-needed flags: {len(reviews)}")
    for k, v in sorted(byr.items(), key=lambda x: -x[1]):
        print(f"     {v:>4}  {k}")

    # ── B. negative controls ─────────────────────────────────────────────────────────────────────────────────
    print("\n== B. negative controls (FIXTURES built from real stored answers — they show what the rule rejects,")
    print("      not that the situation occurs in production)\n")
    set_flags(True)
    # pick a passing generated run that has a capture
    base = None
    # prefer the genuinely ambiguous case (expected manual '(Operational)' names four corpus documents) —
    # that is where a name-substring rule can accept the wrong document.
    for r in sorted(rows, key=lambda x: 0 if (x.get("suite") == "generated" and str(x["case"]) == "4") else 1):
        if r.get("suite") == "generated" and supplied_for(r, spec(r)[5]):
            manual, pages, must, must_not, cls, q, scoped = spec(r)
            v = A.judge_ex(r["response"], manual, pages, must, must_not, cls, supplied=supplied_for(r, q), scoped_must=scoped)
            if v["citation"]:
                base = (r, manual, pages, must, must_not, cls, q, scoped)
                break
    if base:
        r, manual, pages, must, must_not, cls, q, scoped = base
        sup = supplied_for(r, q)
        print(f"  control base: generated case {r['case']} {r['set']} run {r.get('run')} — expected {manual!r}")
        for label, mutate in [
            ("wrong document (a different corpus document substituted in every citation)",
             lambda c: [dict(x, manual="Safety - MOC User Manual_Office_R0_31.03.2026") for x in c]),
            ("lookalike document (another document matching the same name substring)",
             lambda c: [dict(x, manual="Technical - Sync (Operational) User Manual.docx") for x in c]),
            ("lookalike document AND its text not supplied (the combination a name rule cannot catch)",
             lambda c: [dict(x, manual="Technical - Sync (Operational) User Manual.docx") for x in c]),
            ("right document cited, its text never supplied (excerpts emptied)", None),
        ]:
            j = copy.deepcopy(r["response"])
            s = sup
            if mutate is None:
                s = "[1] (Safety - MOC User Manual_Office_R0_31.03.2026 — 1 SOMETHING)\nunrelated text\n"
            else:
                j["citations"] = mutate(j.get("citations") or [])
            set_flags(False)
            o = A.judge_ex(j, manual, pages, must, must_not, cls)
            set_flags(True)
            n = A.judge_ex(j, manual, pages, must, must_not, cls, supplied=s, scoped_must=scoped)
            print(f"    {label}\n       .7 citation={o['citation']}   .8 citation={n['citation']} "
                  f"(support={n['support']}, first-source={n['cite_first']})")
    # a page-anchored control from the frozen suite
    for r in rows:
        if r.get("suite") in (None, "answers"):
            manual, pages, must, must_not, cls, q, scoped = spec(r)
            if not pages:
                continue
            sup = supplied_for(r, q)
            set_flags(True)
            if not A.judge_ex(r["response"], manual, pages, must, must_not, cls, supplied=sup)["citation"]:
                continue
            j = copy.deepcopy(r["response"])
            j["citations"] = [dict(x, section="9.9 WRONG SECTION (p.999)") for x in (j.get("citations") or [])]
            set_flags(False)
            o = A.judge_ex(j, manual, pages, must, must_not, cls)
            set_flags(True)
            n = A.judge_ex(j, manual, pages, must, must_not, cls, supplied=sup)
            print(f"\n  page-anchored control: frozen case {r['case']} {r['set']} run {r.get('run')} "
                  f"(expected {manual!r} p{pages}) with every page forced to 999\n"
                  f"       .7 citation={o['citation']}   .8 citation={n['citation']}")
            break

    # ── C. missing-evidence reclassification ─────────────────────────────────────────────────────────────────
    print("\n== C. every asserted missing-evidence sentence: .7 class → .8 class (decided on the supplied excerpts)\n")
    set_flags(True)
    n_tab = defaultdict(int)
    for r in rows:
        manual, pages, must, must_not, cls, q, scoped = spec(r)
        sup = supplied_for(r, q)
        blocks = A.supplied_blocks(sup)
        text = A.md_plain(r["response"].get("response") or "").lower()
        cited = any(A.doc_stem(str(c.get("manual", ""))) in (A.resolve_documents(manual) or [A.doc_stem(str(c.get("manual", "")))])
                    for c in (r["response"].get("citations") or []))
        for p in set(must_not) & A.DECLINE_PHRASES:
            if p not in text:
                continue
            for s in A._sentences(text):
                if p in s and not A.negated(s, p):
                    A.JUDGE_EVIDENCE_CHECK = False
                    c7 = A.decline_class(s, manual, cited, blocks)
                    A.JUDGE_EVIDENCE_CHECK = True
                    c8 = A.decline_class(s, manual, cited, blocks)
                    n_tab[(c7, c8)] += 1
                    if c7 != c8:
                        print(f"  {r['_dump']:<6} {r.get('suite','answers'):<9} {r['set']:<14} case {str(r['case']):<16} "
                              f"run {r.get('run',1)}: {c7} → {c8}\n     {s.strip()[:200]}")
    print("\n  transition counts (.7 → .8):")
    for (c7, c8), v in sorted(n_tab.items(), key=lambda x: -x[1]):
        print(f"     {v:>4}  {c7} → {c8}")


if __name__ == "__main__":
    main()
