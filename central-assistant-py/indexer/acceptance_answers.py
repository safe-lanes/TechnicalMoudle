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
import json
import os
import re
import sys
from pathlib import Path

import httpx2 as httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.identity import sign_identity  # noqa: E402

# SUITE FROZEN 14-Sep-2026 (SUITE_VERSION below) after every expected answer was checked against the
# source manuals (page renders + the saved parses; see docs/assistant-experiments/2026-09-14-repairs/).
# Any later change to a case must be reported explicitly and bumps SUITE_VERSION.
SUITE_VERSION = "2026-09-14.4"  # .3 (post-freeze, reported): case 08 also requires the final step "download" (Export button, p20)
# .4 (15-Sep-2026, reported, cases UNCHANGED): the judge strips markdown emphasis (**bold**, `code`) before phrase matching —
#     gpt-5.6-luna writes "the **Operation** tab", which the literal check read as "operation** tab" and failed. Re-scored on
#     every stored dump (rejudge_base.py); JUDGE_MD_NORMALISE=False reproduces the .3 matching.
JUDGE_MD_NORMALISE = True
# .5 (18-Sep-2026, reported, cases UNCHANGED — two demonstrated judge defects from the 171-answer review, §15.2):
#   CITATION: the expected manual+page may appear at ANY position in the citation list shown to the user, not only first.
#     Frozen case 05 lists the six hazard categories, is supported by two supplied excerpts and names the expected pages in
#     its own Source line, yet failed because citations[0] happened to be another section of the SAME manual. The check now
#     passes when any shown citation names the expected manual and an accepted page; the top-citation result is still
#     computed and reported separately so nothing is hidden.
#   MUST_NOT: a forbidden phrase inside a negation is not a violation — "Do not create a new approver record" states the
#     manual's own rule. A must_not hit is ignored when a negation ("do not", "does not", "cannot", "never", "no ", "not")
#     appears within 40 characters before it.
# JUDGE_CITATION_ANY=False and JUDGE_NEGATION_AWARE=False reproduce the .4 behaviour exactly.
JUDGE_CITATION_ANY = True
JUDGE_NEGATION_AWARE = True
# .6 (18-Sep-2026, reported, cases UNCHANGED — third demonstrated judge defect, reviewer's second pass, §15.7):
#   The "not covered" family exists to catch an assistant that DECLINES to answer. It also fires on an accurate statement
#   about a SOURCE inside a full answer — "the June PMS user manual excerpt … does not cover these office-generation rules"
#   (which prompt v5 explicitly asks for), or "those capabilities are not covered as available to that role" (which IS the
#   correct answer). Such a phrase is ignored when the answer carries substantive content: two or more instruction lines, or
#   more than 300 characters of body besides the sentence itself. A real refusal has neither, so it still fails.
#   JUDGE_DECLINE_AWARE=False reproduces the .5 behaviour.
JUDGE_DECLINE_AWARE = True
# .7 (18-Sep-2026, reported — the reviewer rejected .6's shortcut: "a long answer can still falsely claim evidence is
#   missing", and length is not evidence of anything). The length/steps test is REMOVED. Each sentence carrying a decline
#   phrase is now classified by WHAT IT IS ABOUT, and only two classes are violations:
#     refusal        — first-person inability, or "no information": the assistant declines.
#     false-evidence — the sentence says a NAMED source does not carry the answer, and that source is the very one the
#                      case expects to carry it. The case's own ground truth makes the claim false.
#     contradicted-by-own-citation — the sentence says the evidence base AS A WHOLE ("the provided documentation", "the
#                      supplied excerpts") lacks it, while the answer cites the expected manual and page. The answer's
#                      own citations contradict the claim, so it is unsupported. This is the class the reviewer asked
#                      for: a long answer that falsely claims evidence is missing.
#   and two that are not violations:
#     limitation-not-retrieved — the same whole-evidence claim when the expected source was NOT among the citations.
#                      The assistant is describing what it was actually given, which is honest and is what the prompt
#                      asks for; the retrieval failure is scored by the citation check, not twice by the answer check.
#     limitation     — the gap is scoped to some OTHER named source ("the June PMS user manual excerpt does not cover
#                      these office-generation rules"), which prompt v5 asks for and which is accurate; or it is about
#                      an attribute rather than the evidence ("those capabilities are not covered as available to that
#                      role", the substance of a correct "No").
#   JUDGE_DECLINE_SCOPE=False falls back to .6 (has_substance), and with JUDGE_DECLINE_AWARE=False to .5.
JUDGE_DECLINE_SCOPE = True
JUDGE_VERSION = "7"
DECLINE_PHRASES = {"not covered", "isn't covered", "not documented", "does not cover", "no information",
                   "do not describe", "does not describe", "not described"}
# A sentence "names a source" when it points at a specific document, module or section.
_SOURCE_NAMED = re.compile(
    r"(§\s*[\d.]+|\bp\.?\s?\d{1,3}\b"
    r"|\b(pms|crewing|safety|technical|audit|incident|sms|moc|master review|risk assessment|near miss|defects?|"
    r"fleet sharing|recent updates|bulk data import|ship-side|roles?(?= manual| document)|preparation|inspection)\b"
    r"[^.]{0,40}?\b(manual|documentation|document|notes|guide|excerpt|excerpts|section|file)\b"
    r"|\b(manual|documentation|document|notes|guide|excerpt|excerpts|section|file)\b[^.]{0,30}?"
    r"\b(pms|crewing|safety|technical|audit|incident|sms|moc|master review|risk assessment|near miss|defects?|"
    r"fleet sharing|recent updates|bulk data import|ship-side)\b)", re.I)
# The evidence base as a whole, with no document named.
_GLOBAL_EVIDENCE = re.compile(
    r"\b(i (do not|don't|cannot|can't|am unable|was unable)|no information\b|not enough information"
    r"|(the |these |any |all )?(provided|supplied|available|given|attached|retrieved)\s+"
    r"(documentation|manuals?|documents?|excerpts?|sources?|material|content)"
    r"|(the )?(documentation|manuals?|excerpts?|sources?) (provided|supplied|available|given|retrieved)"
    r"|\b(this|that|it|the question|the topic|the answer) (is|was) not (covered|documented|described))\b", re.I)


def present(ans: str, phrase: str) -> bool:
    """A required phrase. 'a||b||c' is satisfied by ANY alternative — used where one fact has several natural
    wordings ("no role check" / "does not require a specific role" / "any user with access"). A phrase without
    '||' behaves exactly as before, so no existing case changes."""
    return any(alt.strip().lower() in ans for alt in phrase.split("||"))


def _sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip()]


VIOLATING_DECLINES = ("refusal", "false-evidence", "contradicted-by-own-citation")


def decline_class(sentence: str, expected_source: str, cited_expected: bool = False) -> str:
    """What a decline phrase in this sentence is about:

      refusal                      — first-person inability, or "no information": the assistant declines. Violation.
      false-evidence               — says the case's OWN expected source does not carry the answer. Violation.
      contradicted-by-own-citation — says the evidence base as a whole ("the provided documentation") lacks it, while
                                     the answer cites the expected manual and page. The answer's own citations
                                     contradict the claim, so it is unsupported. Violation.
      limitation-not-retrieved     — the same whole-evidence claim when the expected source was NOT retrieved. The
                                     assistant is describing what it was actually given; honest. Not a violation.
      limitation                   — the gap is scoped to some OTHER named source, or to an attribute rather than to
                                     the evidence. Not a violation.
    """
    named = _SOURCE_NAMED.search(sentence)
    if named:
        tok = named.group(0).lower()
        exp = (expected_source or "").lower().strip()
        words = [w for w in re.findall(r"[a-z]{3,}", exp) if w not in {"the", "and", "manual", "office", "user", "notes", "operational"}]
        if exp and words and all(w in tok for w in words):
            return "false-evidence"
        return "limitation"
    if re.search(r"\b(i (do not|don't|cannot|can't|am unable|was unable)|no information\b|not enough information)", sentence, re.I):
        return "refusal"
    if _GLOBAL_EVIDENCE.search(sentence):
        return "contradicted-by-own-citation" if cited_expected else "limitation-not-retrieved"
    return "limitation"


def decline_violates(text: str, phrase: str, expected_source: str, cited_expected: bool = False) -> bool:
    """True when at least one sentence asserting `phrase` is a refusal or an unsupported missing-evidence claim."""
    hits = [s for s in _sentences(text) if phrase.lower() in s.lower() and not negated(s.lower(), phrase)]
    return any(decline_class(s, expected_source, cited_expected) in VIOLATING_DECLINES for s in hits)


def has_substance(text: str) -> bool:
    """.6 only, kept so JUDGE_DECLINE_SCOPE=False reproduces the published .6 scores exactly."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    steps = sum(1 for ln in lines if re.match(r"^(\d+[.)]|[-*•]|\d+\.\d+)\s+\S", ln))
    return steps >= 2 or len(re.sub(r"\s+", " ", text)) > 300


def negated(text: str, phrase: str) -> bool:
    """True when every occurrence of `phrase` sits inside a negation (so it is not an assertion of that phrase)."""
    low, p = text.lower(), phrase.lower()
    starts = [m.start() for m in re.finditer(re.escape(p), low)]
    if not starts:
        return False
    return all(re.search(r"\b(do not|does not|don't|doesn't|cannot|can't|never|no|not|without)\b[^.]{0,40}$", low[max(0, i - 60):i]) for i in starts)


def md_plain(text: str) -> str:
    """Remove markdown emphasis markers without touching the words: **x** → x, *x* → x, `x` → x."""
    t = re.sub(r"\*\*|`", "", text)
    return re.sub(r"(?<!\w)\*(?=\S)|(?<=\S)\*(?!\w)", "", t)
NOT_COVERED = ["not covered", "isn't covered", "not documented", "does not cover", "no information"]
# (class, question, module, expected manual substring, accepted pages (None = any), must phrases, must_not phrases, source note)
CASES: list[tuple[str, str, str, str, tuple[int, ...] | None, list[str], list[str], str]] = [
    ("callout", "In the audit preparation checklist observations view, how do I export the data and what do I do with vessel comments?",
     "audit", "Preparation", (15,), ["export", "vessel comments", "yes", "save"], NOT_COVERED,
     "Audit Preparation Office R1 p15 Figure 20 callouts: Excel icon top-right exports the data; enter vessel comments and select compliance Yes/No; click Save. (Callouts exist only in the screenshot — extraction repair.)"),
    ("callout", "In Audit Preparation, what does the email notification icon do and is it configurable?",
     "audit", "Preparation", (9,), ["email notification", "office", "client"], NOT_COVERED,
     "Audit Preparation Office R1 p9 §2.5: click the icon to notify the Office that the checklist has been completed; optional, client-specific/configurable."),
    ("callout", "How do I upload a document for the first time in the SMS module?",
     "safety", "SMS", (14,), ["new document"], NOT_COVERED,
     "SMS Office R0 p14 §4.1: click the +New Document tab (starts the change request: Proposal, Approval, Release)."),
    ("table", "In the Master Review module, what do the grey and red icons mean?",
     "safety", "Master Review", (6,), ["due", "overdue"], NOT_COVERED,
     "Master Review R1 p6 Office Response table: grey = Response Due, red = Response Overdue (green tick = completed)."),
    ("table", "What are the hazard categories in a risk assessment?",
     "safety", "Risk Assessment", (13, 12), ["work environment", "equipment", "programs", "processes", "people", "organization"], NOT_COVERED,
     "RA Office R1 p13 Figure 15 / RA Vessel R1 p12 Figure 14 'Select Applicable Hazards' tabs: 1 Work Environment, 2 Equipment, 3 Programs/Procedures, 4 Processes (Act), 5 People, 6 Organization. (Tabs exist only in the screenshot — extraction repair.)"),
    ("table", "What actions can I take on a near miss record from the list — what do the icons do?",
     "incident", "Near Miss", (5,), ["view", "edit", "delete"], NOT_COVERED,
     "Near Miss R1 p5 action-icon table: eye = View Record (view/edit/export), pencil = Edit Record, bin = Delete Record."),
    ("xref", "How do I apply a filter in the Stores sub-module of PMS?",
     "technical", "PMS User Manual", (49, 47), ["spares", "vessel", "filter"], NOT_COVERED,
     "PMS Office R2 p49 §1.1.8.2 says 'Refer to the Spares sub-sub-module for the filter process and apply the same steps' → §1.1.7.7 p47: open Spares (Inventory tab by default), select the Vessel, search for parts/components, apply filters such as Criticality, Rotation Item and Stock. Answer must name the Spares section as the source."),
    ("xref", "How do I export crew details from the Waitlist in Crewing?",
     "crewing", "Crewing", (22, 19, 20), ["in-progress", "edit", "export", "download"], NOT_COVERED + ["crew database"],
     "Crewing R2 p22 §1.2.3.3 says 'Refer to the In-Progress sub-sub-module for the export process and apply the same steps' → §1.2.1.5 p19–20: open the record with the Edit icon, then click the Export button to download the crew form. There is no 'Onboard list' in Crewing (Recruitment = In-Progress / Recruited / Waitlist / Rejected); Crew Database export (§1.3.1.4 p28) is a different sub-module and must not be used."),
    ("xref", "How do I create a COC defect record?",
     "technical", "Defects", (19, 15), ["new defect", "submit"], NOT_COVERED,
     "Defects Office R2 p19 §1.1.5.2 says 'Refer to the Defect Log sub-submodule and follow the same procedure' → §1.1.4.3 p15: click '+ New Defect', fill Part A, B and C, click Submit."),
    ("note", "When filling MoC Part B, what happens if I select No for further assessment?",
     "safety", "MOC", (11,), ["not processed"], NOT_COVERED,
     "MOC Office R0 p11 §6 note: if 'No' is selected the MoC is marked 'Not Processed'."),
    ("note", "In PMS, is there another way to add a component besides the components panel?",
     "technical", "PMS User Manual", (24,), ["add component"], NOT_COVERED,
     "PMS Office R2 p24 §1.1.4.3 note inside Figure 35: a new component can also be added by clicking the '+ Add Component' button."),
    ("note", "What should I review after deleting an implication in a vessel MoC?",
     "safety", "MOC", (9,), ["part e", "action"], NOT_COVERED,
     "MOC Vessel R0 p9 note: after deletion review the Part E – Action table to ensure data consistency."),
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


def judge(j: dict, manual: str, page: tuple[int, ...] | int | None, must: list[str], must_not: list[str], cls: str) -> tuple[bool, bool, bool, str]:
    """(answer ok, citation ok, attribution ok, detail). Attribution matters for xref cases:
    an answer built from another section's text must name where it came from (the resolver
    labels pulled-in text with its source section and page)."""
    raw = j.get("response") or ""
    ans = md_plain(raw).lower() if JUDGE_MD_NORMALISE else raw.lower()
    cits = j.get("citations") or []
    top = cits[0] if cits else {}
    pages = (page,) if isinstance(page, int) else page
    def cite_matches(ci: dict) -> bool:
        return manual.lower() in str(ci.get("manual", "")).lower() and (pages is None or page_of(ci) in pages)
    cited_expected = any(cite_matches(ci) for ci in cits)
    def excused(p: str) -> bool:
        if not (JUDGE_DECLINE_AWARE and p.lower() in DECLINE_PHRASES):
            return False
        if JUDGE_DECLINE_SCOPE:
            return not decline_violates(ans, p, manual, cited_expected)
        return has_substance(ans)
    forbidden_hit = [p for p in must_not
                     if p.lower() in ans
                     and not (JUDGE_NEGATION_AWARE and negated(ans, p))
                     and not excused(p)]
    ok_answer = all(present(ans, p) for p in must) and not forbidden_hit and j.get("gate") == "answer"
    if cls == "xref" and re.search(r"refer to the ['‘\"]?[\w &-]+['’\"]? (sub-)?(sub-)?module", ans) and not re.search(r"^\s*\d+\.\s+(click|go to|select|open|use|enter)", ans, re.M):
        ok_answer = False  # judge tightened 14-Sep-2026: parroting the manual's pointer ("Refer to the X sub-module, follow the same procedure") is NOT an answer
    ok_cite_top = cite_matches(top)
    # Citation-anywhere applies ONLY to page-anchored cases. With pages=None the test is a manual-name substring, and a
    # name can match a DIFFERENT document ("(Operational)" matches both the Sync and the Ship-Side notes), which would
    # let a filename appearing anywhere in the citation list stand in for support. Page-anchored cases do not have that
    # hole: manual + accepted page identifies one section.
    ok_cite = (any(cite_matches(ci) for ci in cits) if (JUDGE_CITATION_ANY and pages is not None) else ok_cite_top)
    ok_attr = True
    if cls == "xref" and ok_answer:
        ok_attr = bool(re.search(r"(taken from|same as|from section|section \d+(\.\d+)+|see (the )?'?[\w &-]+'? (sub-)?(sub-)?module)", raw, re.I))
    detail = (f"gate={j.get('gate')} cite={str(top.get('manual', '-'))[:26]} p{page_of(top)}"
              + ("" if ok_cite_top or not ok_cite else " [expected page cited, not first]")
              + (f" [must_not in negation: {forbidden_neg}]" if (forbidden_neg := [p for p in must_not if p.lower() in ans and JUDGE_NEGATION_AWARE and negated(ans, p)]) else "")
              + (f" [decline scoped to another source, not a refusal: {excused_dec}]" if (excused_dec := [p for p in must_not if p.lower() in ans and p.lower() in DECLINE_PHRASES and p not in forbidden_hit and not (JUDGE_NEGATION_AWARE and negated(ans, p))]) else "")
              + f" | {raw[:64]!r}")
    return ok_answer, ok_cite, ok_attr, detail


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True, help="NAME=SERVICE_URL (repeatable)")
    ap.add_argument("--repeat", type=int, default=1, help="ask each case N times per set; a case passes when the MAJORITY of runs pass (LLM answers vary run to run)")
    ap.add_argument("--dump", default=None, help="write every full response (case, set, run, verdict, response JSON) as JSON lines to this file")
    args = ap.parse_args()
    key = os.environ["IDENTITY_SIGNING_KEY"]
    sets = [(s.partition("=")[0], s.partition("=")[2]) for s in args.set]
    dump = open(args.dump, "w", encoding="utf-8") if args.dump else None  # noqa: SIM115
    score = {n: [0, 0, 0, 0] for n, _ in sets}  # answer, cite, attribution, JOINT
    matrix: list[tuple[str, dict[str, bool]]] = []
    flaky: list[str] = []
    async with httpx.AsyncClient(timeout=150.0) as c:
        print(f"acceptance suite {SUITE_VERSION} · {len(CASES)} cases · repeat={args.repeat}")
        for i, (cls, q, module, manual, page, must, must_not, _src) in enumerate(CASES, 1):
            print(f"\n[{i:02d} {cls}] {q}")
            runs = [await asyncio.gather(*(ask(c, u, key, q, module) for _, u in sets)) for _ in range(args.repeat)]
            row: dict[str, bool] = {}
            for si, (n, _) in enumerate(sets):
                verdicts = [judge(runs[r][si], manual, page, must, must_not, cls) for r in range(args.repeat)]
                if dump:
                    for r in range(args.repeat):
                        dump.write(json.dumps({"case": i, "class": cls, "question": q, "set": n, "run": r + 1,
                                               "verdict": {"answer": verdicts[r][0], "citation": verdicts[r][1], "attribution": verdicts[r][2]},
                                               "response": runs[r][si]}, ensure_ascii=False) + "\n")
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
    if dump:
        dump.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
