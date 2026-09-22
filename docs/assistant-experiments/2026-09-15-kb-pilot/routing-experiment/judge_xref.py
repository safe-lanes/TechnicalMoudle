# Judge the cross-reference answer comparison against the FROZEN expectations.
#
# Three buckets, reported separately for every arm and every run, never merged:
#   correct    the destination procedure, with citations, breaking no must_not rule
#   limited    honest but incomplete — no procedure given, or a case capped at 'limited'
#   incorrect  a must_not hit: the source screen, record type or an unverified field survived
#
# must_not is decisive. A case with bucket_cap can never score above that bucket.
# The judge reads the FINAL ANSWER, not the indexed text — the point of the test is that the old
# instructions are still present in the quoted part of the document.
#
#   python judge_xref.py            # table
#   python judge_xref.py --read     # + every answer in full, for reading
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = json.loads((HERE / "xref_expectations.json").read_text(encoding="utf-8"))
CASES = {c["id"]: c for c in SPEC["cases"]}
D = json.loads((HERE / "xref-answers.json").read_text(encoding="utf-8"))

# a procedural answer tells the reader to do something, more than once
STEP = re.compile(r"(?:^|\n)\s*(?:\d+[.)]|[-*•])\s|\b(?:click|select|choose|enter|open|go to)\b", re.I)


# NOTE: written with the editor, not through a shell heredoc — an earlier version of these two
# patterns had every \b turned into a literal backspace (\x08) by shell escaping, so neither could
# ever match and every attribution and denial was scored as a wrong instruction. self_test() pins both.
CITATION = re.compile("same as|same steps|section |page |source *:|cross-?referenc|"
                      "quoted|according to|stated as", re.I)
# Widened 22-Sep after the reviewer found three false failures: "does **not** use the Spares-only
# Criticality or Rotation Item filters", "do **not** exist on the Stores screen", "Issue Date does not
# apply to Surveys" — all correct denials. Two causes: the pattern was applied to the RAW sentence,
# so Markdown bold inside "does **not** use" broke it; and "does not use / apply / establish" were
# missing. Both patterns are now applied to the normalised sentence.
DENIAL = re.compile("not available|not exist|does not exist|do not exist|are not|is not|no longer|"
                    "not present|not offered|not on this screen|unavailable|does not use|do not use|"
                    "does not apply|do not apply|not apply to|does not establish|do not establish|"
                    "not established|not to exist|stated not to|said not to", re.I)


def self_test() -> None:
    """A discount rule that cannot fire, or fires on everything, would silently invert this report."""
    must_discount = ["This procedure is the same as In Progress, section 1.2.1.5, page 19.",
                     "Criticality and Rotation Item are not available on this screen.",
                     # the reviewer's three false failures (22-Sep), verbatim from the stored answers
                     "The Stores screen does **not** use the Spares-only **Criticality** or **Rotation Item** filters.",
                     "The **Criticality** and **Rotation Item** filters mentioned in the Spares source text do **not** exist on the Stores screen.",
                     "The certificate field **Issue Date** does not apply to Surveys.",
                     # rerun, 22-Sep: a denial in the form "stated not to exist" — correct, was flagged
                     "**Criticality** and **Rotation Item** are named in the referenced Spares steps but are stated not to exist on the Stores screen."]
    # the rerun's other flag is a PROVENANCE defect (my note attributed to the manual), not a wrong screen
    prov = "the manual notes that the sequence is transferable, while the referenced screen details describe In Progress."
    if not PROVENANCE.search(prov):
        raise SystemExit("judge self-test FAILED: provenance misattribution not detected")
    must_keep = ["Click the In-Progress sub-sub-module.",
                 "Use the dropdown filters for Criticality, Rotation Item, or Stock.",
                 "- **Criticality**"]                     # a bare bullet offering the field IS an instruction
    # the reviewer's catch: bold markers between the words hid three wrong-screen instructions
    bold = "Go to the **Certificates** sub-submodule."
    if "certificates sub" not in normalise(bold):
        raise SystemExit("judge self-test FAILED: Markdown bold still hides a must_not term")
    if not (CITATION.search(bold) is None and DENIAL.search(bold) is None):
        raise SystemExit("judge self-test FAILED: a bare wrong-screen instruction was discounted")
    # tested exactly as judge() tests them: on the NORMALISED sentence (bold, dashes, quotes stripped)
    for s in must_discount:
        if not (CITATION.search(normalise(s)) or DENIAL.search(normalise(s))):
            raise SystemExit(f"judge self-test FAILED: should discount -> {s!r}")
    for s in must_keep:
        if CITATION.search(normalise(s)) or DENIAL.search(normalise(s)):
            raise SystemExit(f"judge self-test FAILED: should NOT discount -> {s!r}")
    # 22-Sep: stored answers PROVEN wrong against the product code (a Stores user told to open Spares) must
    # score 'incorrect' under the stores-bulk-update case — a judge that passes them is broken.
    negp = HERE / "stores-bulk-negative-examples.json"
    if negp.exists() and "stores-bulk-update" in CASES:
        for ex in json.loads(negp.read_text(encoding="utf-8"))["examples"]:
            b, why = judge(CASES["stores-bulk-update"], ex["response"] or "")
            if b != "incorrect":
                raise SystemExit(f"judge self-test FAILED: negative example run {ex['run']} scored {b!r}: {why}")
        print("judge self-test: the 3 stored wrong Stores answers score 'incorrect'")
    print("judge self-test: passed (discounts attribution and denial, keeps real instructions)\n")


def normalise(text: str) -> str:
    """Markdown and typography must not hide a match. The reviewer found all three baseline Surveys
    answers scored 'correct' because "Go to the **Certificates** sub-submodule" carries bold markers
    between the words the pattern looks for. Strip emphasis markers, unify dash variants and
    whitespace before ANY matching — patterns and answers alike."""
    t = re.sub(r"[*_`]+", "", text or "")
    t = re.sub("[‐‑‒–—―]", "-", t)
    t = t.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", t).strip().lower()


def sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.:;])\s+|\n", text or "") if s.strip()]


# The answer attributes MY indexing note ("screen details not verified") to the manual. The manual
# says no such thing; the note was generated at index time. A wrong statement about the source.
# Tightened 22-Sep after the reviewer's read: "the manual confirms the action sequence, but the screen
# details have not been separately verified" attributes only the CONFIRMATION to the manual, which is
# true; the regex had treated both clauses as attributed. A misattribution is the manual being said to
# NOTE/STATE/SAY that something is unverified — that is my indexing note, not the manual's.
PROVENANCE = re.compile(r"(manual|documentation)\s+(notes|states|says|indicates|explains)\s+that[^.;]{0,140}"
                        r"(not (been )?(separately )?(verified|confirmed|established)|unverified|adaptation of|"
                        r"transferable|screen details describe)", re.I)


def judge(case: dict, text: str) -> tuple[str, list[str]]:
    """(bucket, reasons). Reads the FINAL ANSWER only.

    A must_not term is decisive only when it appears as an INSTRUCTION. The frozen intent was to
    forbid the wrong instruction, not the word: an answer that cites the source section ("the same
    as ... under In Progress, page 19") or explicitly denies the wrong field ("Criticality and
    Rotation Item are not available on this screen") is doing the right thing. Both exemptions were
    added AFTER the run, on reading the answers, and every discounted hit is reported."""
    t = normalise(text)
    reasons = []
    if PROVENANCE.search(text or ""):
        # a false statement about the SOURCE — reported and kept visible, but it is a different kind
        # of defect from a wrong instruction, so it does not by itself change the bucket
        reasons.append("PROVENANCE: attributes the indexing note to the manual")
    hits, discounted = [], []
    # EVERY sentence carrying the term is examined, not just the first. An answer can cite the
    # source honestly in one line ("the same steps as In-Progress, section 1.2.1.5") and still give
    # the wrong instruction two lines later ("Click the In-Progress sub-sub-module") — stopping at
    # the first match scored exactly that answer as correct.
    for pat in case.get("must_not", []):
        npat = normalise(pat)
        for sent in sentences(text):
            nsent = normalise(sent)
            if npat in nsent:
                if CITATION.search(nsent) or DENIAL.search(nsent):
                    discounted.append(f"{pat!r} discounted (attribution/denial): “{sent[:110]}”")
                else:
                    hits.append(f"{pat!r} as an instruction: “{sent[:110]}”")
    reasons.extend(discounted)
    if hits:
        return "incorrect", ["must_not " + h for h in hits] + reasons

    missing_any = [g for g in case.get("must_include_any", []) if not any(normalise(w) in t for w in g)]
    missing_all = [g for g in case.get("must_include_all", []) if not all(normalise(w) in t for w in g)]
    if missing_any or missing_all:
        reasons.append(f"missing required term(s): {missing_any + missing_all}")
        return "limited", reasons

    if case.get("procedural", True) and len(STEP.findall(text or "")) < 2:
        reasons.append("no procedure given (fewer than two instruction markers)")
        return "limited", reasons

    cap = case.get("bucket_cap")
    if cap:
        reasons.append(f"capped at '{cap}': {case.get('bucket_cap_reason', '')[:90]}")
        return cap, reasons
    return "correct", reasons


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--read", action="store_true")
    args = ap.parse_args()
    self_test()
    R = D["results"]
    errs = [r for r in R if r.get("error")]
    print(f"{len(R)} answers · {D['runs']} runs · {len(CASES)} frozen cases · errors {len(errs)}")
    for e in errs[:4]:
        print("   ERROR", e["id"], e["arm"], str(e["error"])[:80])

    verdict = {}
    for r in R:
        verdict[(r["id"], r["arm"], r["run"])] = judge(CASES[r["id"]], r.get("response") or "")

    print(f"\n{'case':<26} " + " ".join(f"{a+' r'+str(i):<14}" for a in D["arms"] for i in (1, 2, 3)))
    print("-" * 112)
    for cid in CASES:
        row = " ".join(f"{verdict[(cid, a, i)][0]:<14}" for a in D["arms"] for i in (1, 2, 3))
        print(f"{cid:<26} {row}")

    print("\nTOTALS per arm (each of 3 runs counted separately)")
    for arm in D["arms"]:
        tal = defaultdict(int)
        for cid in CASES:
            for i in (1, 2, 3):
                tal[verdict[(cid, arm, i)][0]] += 1
        n = sum(tal.values())
        print(f"   {arm:<10} correct {tal['correct']:>2}/{n}   limited {tal['limited']:>2}/{n}   "
              f"incorrect {tal['incorrect']:>2}/{n}")

    print("\nWHY, per case (run 1 shown; differences across runs flagged)")
    for cid in CASES:
        for arm in D["arms"]:
            bs = [verdict[(cid, arm, i)][0] for i in (1, 2, 3)]
            note = "" if len(set(bs)) == 1 else f"   [varies across runs: {bs}]"
            why = "; ".join(verdict[(cid, arm, 1)][1]) or "-"
            print(f"   {cid:<26} {arm:<10} {bs[0]:<10} {why[:70]}{note}")

    if args.read:
        for cid in CASES:
            print("\n" + "=" * 110)
            print(f"{cid}   Q: {CASES[cid]['question']}")
            print(f"   must_not: {CASES[cid].get('must_not')}")
            for arm in D["arms"]:
                for i in (1, 2, 3):
                    r = next(x for x in R if x["id"] == cid and x["arm"] == arm and x["run"] == i)
                    b, why = verdict[(cid, arm, i)]
                    print(f"\n--- {arm} run {i} [{b}] {'; '.join(why)}")
                    cites = [f"{c.get('module')}:{str(c.get('manual'))[:34]}" for c in (r.get("citations") or [])]
                    print("    cites: " + (", ".join(cites) or "-"))
                    print("    " + (r.get("response") or "").replace("\n", "\n    ")[:1400])


if __name__ == "__main__":
    main()
