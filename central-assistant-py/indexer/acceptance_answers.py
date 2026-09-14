"""
Answer-level acceptance suite (owner ask 14-Sep-2026 — "the 18 queries do not probe the
content the cleanup removes"). Each query targets exactly the content classes the cleanup
touches, and is judged on the ANSWER TEXT and the CITED SOURCE (manual + page), not on
retrieval rank:

  callout  instruction that exists only inside a screenshot callout on the page
  table    a genuine table (icon legend, category list, matrix)
  xref     a section that is only a cross-reference in the manual (resolved at index time)
  note     a "Note:" line that sits inside a figure zone
  strike   nothing struck-through may surface as current instruction

  IDENTITY_SIGNING_KEY=... python indexer/acceptance_answers.py --set migrated=http://127.0.0.1:8015 --set ce-clean=http://127.0.0.1:8018

Scoring per query per set: answer contains ALL `must` phrases (case-insensitive) and NONE of
`must_not`; top citation names the expected manual and (for PDFs) the expected page.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
from pathlib import Path

import httpx2 as httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.identity import sign_identity  # noqa: E402

# (class, question, module, expected manual substring, expected page (None = any), must phrases, must_not phrases)
CASES: list[tuple[str, str, str, str, int | None, list[str], list[str]]] = [
    ("callout", "In the audit preparation checklist observations view, how do I export the data and what do I do with vessel comments?",
     "audit", "Preparation", 15, ["export"], []),
    ("callout", "In Audit Preparation, what does the email notification icon do and is it configurable?",
     "audit", "Preparation", 9, ["email", "client"], []),
    ("callout", "How do I upload a document for the first time in the SMS module?",
     "safety", "SMS", 14, ["new document"], []),
    ("table", "In the Master Review module, what do the grey and red icons mean?",
     "safety", "Master Review", 6, ["due", "overdue"], []),
    ("table", "What are the hazard categories in a risk assessment?",
     "safety", "Risk Assessment", None, ["work environment", "equipment"], []),
    ("table", "What actions can I take on a near miss record from the list — what do the icons do?",
     "incident", "Near Miss", 5, ["view"], []),
    ("xref", "How do I apply a filter in the Stores sub-module of PMS?",
     "technical", "PMS User Manual", None, ["filter"], ["not covered", "isn't covered", "not documented"]),
    ("xref", "How do I export crew details from the Onboard list in Crewing?",
     "crewing", "Crewing", None, ["export"], ["not covered", "isn't covered", "not documented"]),
    ("xref", "How do I create a COC defect record?",
     "technical", "Defects", None, ["defect"], ["not covered", "isn't covered", "not documented"]),
    ("note", "When filling MoC Part B, what happens if I select No for further assessment?",
     "safety", "MOC", 11, ["not processed"], []),
    ("note", "In PMS, is there another way to add a component besides the components panel?",
     "technical", "PMS User Manual", 24, ["add component"], []),
    ("note", "What should I review after deleting an implication in a vessel MoC?",
     "safety", "MOC", 9, ["action"], []),
]

_n = 0


async def ask(client: httpx.AsyncClient, base: str, key: str, q: str, module: str) -> dict:
    global _n
    _n += 1
    tok = sign_identity({"userId": f"accept-{_n}", "userName": "Acceptance", "role": "Sail Admin", "tenantDomain": "smoke-suite-tenant"}, key, 60)
    r = await client.post(f"{base}/chat", headers={"x-assistant-identity": tok}, json={"message": q, "context": {"module": module}})
    return r.json()


def page_of(citation: dict) -> int | None:
    m = re.search(r"\(p\.(\d+)\)", str(citation.get("section") or ""))
    return int(m.group(1)) if m else None


def judge(j: dict, manual: str, page: int | None, must: list[str], must_not: list[str], cls: str) -> tuple[bool, bool, bool, str]:
    """(answer ok, citation ok, attribution ok, detail). Attribution matters for xref cases:
    an answer built from another section's text must name where it came from (the resolver
    labels pulled-in text with its source section and page)."""
    raw = j.get("response") or ""
    ans = raw.lower()
    ok_answer = all(p.lower() in ans for p in must) and not any(p.lower() in ans for p in must_not) and j.get("gate") == "answer"
    cits = j.get("citations") or []
    top = cits[0] if cits else {}
    ok_cite = manual.lower() in str(top.get("manual", "")).lower() and (page is None or page_of(top) == page)
    ok_attr = True
    if cls == "xref" and ok_answer:
        ok_attr = bool(re.search(r"(taken from|same as|from section|section \d+(\.\d+)+|see (the )?'?[\w &-]+'? (sub-)?(sub-)?module)", raw, re.I))
    detail = f"gate={j.get('gate')} cite={str(top.get('manual', '-'))[:26]} p{page_of(top)} | {raw[:64]!r}"
    return ok_answer, ok_cite, ok_attr, detail


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True, help="NAME=SERVICE_URL (repeatable)")
    ap.add_argument("--repeat", type=int, default=1, help="ask each case N times per set; a case passes when the MAJORITY of runs pass (LLM answers vary run to run)")
    args = ap.parse_args()
    key = os.environ["IDENTITY_SIGNING_KEY"]
    sets = [(s.partition("=")[0], s.partition("=")[2]) for s in args.set]
    score = {n: [0, 0, 0, 0] for n, _ in sets}  # answer, cite, attribution, JOINT
    matrix: list[tuple[str, dict[str, bool]]] = []
    flaky: list[str] = []
    async with httpx.AsyncClient(timeout=150.0) as c:
        for i, (cls, q, module, manual, page, must, must_not) in enumerate(CASES, 1):
            print(f"\n[{i:02d} {cls}] {q}")
            runs = [await asyncio.gather(*(ask(c, u, key, q, module) for _, u in sets)) for _ in range(args.repeat)]
            row: dict[str, bool] = {}
            for si, (n, _) in enumerate(sets):
                verdicts = [judge(runs[r][si], manual, page, must, must_not, cls) for r in range(args.repeat)]
                votes = [(a and ct and at) for a, ct, at, _ in verdicts]
                joint = sum(votes) * 2 > len(votes)
                a = sum(v[0] for v in verdicts) * 2 > len(verdicts)
                ct = sum(v[1] for v in verdicts) * 2 > len(verdicts)
                at = sum(v[2] for v in verdicts) * 2 > len(verdicts)
                score[n][0] += a
                score[n][1] += ct
                score[n][2] += at
                score[n][3] += joint
                row[n] = joint
                agree = f"{sum(votes)}/{len(votes)}"
                if 0 < sum(votes) < len(votes):
                    flaky.append(f"{i:02d} {cls} · {n} ({agree})")
                print(f"   {n:<14} answer {'✓' if a else '✗'}  cite {'✓' if ct else '✗'}  attrib {'✓' if at else '✗'}  JOINT {'✓' if joint else '✗'} [{agree}]  {verdicts[0][3]}")
            matrix.append((f"{i:02d} {cls}", row))
    if args.repeat > 1:
        print(f"\n== run-to-run disagreement (cases where runs split, {args.repeat} runs) ==")
        for f in flaky or ["none"]:
            print(f"   {f}")
    print(f"\n== per-case JOINT (answer ∧ citation ∧ attribution) — out of {len(CASES)} ==")
    print("   case          " + " ".join(f"{n[:12]:>12}" for n, _ in sets))
    for label, row in matrix:
        print(f"   {label:<13} " + " ".join(f"{('✓' if row[n] else '✗'):>12}" for n, _ in sets))
    print("\n== totals: answer / citation / attribution / JOINT ==")
    for n, _ in sets:
        s = score[n]
        print(f"   {n:<14} {s[0]}/{len(CASES)}  {s[1]}/{len(CASES)}  {s[2]}/{len(CASES)}  JOINT {s[3]}/{len(CASES)}")
    # regression view: cases the FIRST set gets right that any other set gets wrong
    base = sets[0][0]
    for n, _ in sets[1:]:
        lost = [lbl for lbl, row in matrix if row[base] and not row[n]]
        gained = [lbl for lbl, row in matrix if not row[base] and row[n]]
        print(f"   {n:<14} vs {base}: regressions {lost or 'none'} | gains {gained or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
