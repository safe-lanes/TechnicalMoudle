# Verdict engine over ledger.json. Two layers, kept strictly apart in the output:
#
#   MACHINE  — deterministic rules below. Fast, auditable, and NOT a reading. Claims it marks `auto-supported`
#              have NOT been read by a person and are never reported as verified.
#   READ     — verdicts recorded by hand in review-verdicts.json, keyed by claim id. These override the machine.
#
# Machine rules, in order (first match wins):
#   R1 number/limit   every number in the claim must appear in some supplied passage → else CONTRADICTED-OR-UNSUPPORTED
#   R2 negation flip  the claim negates a requirement that a supplied passage asserts (or vice versa) → CONFLICT
#   R3 permission     a role/permission claim whose role token is absent from every supplied passage → UNSUPPORTED
#   R4 comparison     both compared entities must appear, in >=2 distinct passages, with matching action/screen/
#                     environment tokens → otherwise UNRESOLVED (a comparison cannot be settled by presence alone)
#   R5 strong single  best single sentence covers >=0.70 of the claim's content words → auto-supported
#   R6 otherwise      UNRESOLVED — needs reading
#
#   python verdicts.py run F1          # machine pass, writes verdicts-<arm>.json and prints the surfaced set
#   python verdicts.py surface F1      # print only what needs reading, grouped by distinct claim
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ledger as L                 # noqa: E402
import acceptance_answers as A     # noqa: E402

REQ = r"\b(must|require[sd]?|need(s|ed)?|mandatory|only if|only when|has to|have to)\b"
NEG = r"\b(not|no|never|without|cannot|can't|n't|except|exempt|neither|nor|does not|do not)\b"
ROLE = r"(sail admin|pms admin|client admin|head of dept|vessel admin|vessel user|office user|super admin|" \
        r"\boffice\b|\bship\b|\bvessel\b)"
ENV = r"\b(office|ship|vessel|shore)\b"
SCREEN = r"\b(work orders?|components?|spares?|stores?|dashboard|reports?|admin|settings|part [a-e]|" \
         r"promotions?|crew|inspection|checklist|review)\b"


def nums(s):
    return set(re.findall(r"\b\d+(?:\.\d+)?\s*(?:mb|kb|gb|%|days?|hours?)?\b", s.lower()))


def machine(c):
    ev = c["evidence"]
    if not ev:
        return "UNRESOLVED", "no supplied passages captured"
    # FIXED 19-Sep: include the DOCUMENT name as well as the section. Searching only the body text produced
    # two false "unsupported" findings (fn-2: 'Lesson Learnt' is in the excerpt header, not the body).
    joined = " ".join((e["best_sentence"] or "") + " " + (e["section"] or "") + " " + (e["doc"] or "")
                      for e in ev).lower()
    claim = c["claim"].lower()

    # R1 — numbers and limits
    cn = {n for n in nums(claim) if not re.fullmatch(r"\d", n.strip())}
    if cn:
        missing = [n for n in cn if n.strip() not in joined]
        if missing:
            return "CHECK-NUMBER", f"number(s) {missing} not in the top passages"

    # R2 — negation flip against a requirement
    if re.search(NEG, claim) and re.search(REQ, claim):
        for e in ev:
            s = (e["best_sentence"] or "").lower()
            if re.search(REQ, s) and not re.search(NEG, s) and e["sentence_coverage"] >= 0.5:
                return "CHECK-NEGATION", f"claim negates what '{e['doc'][:40]}' asserts"

    # R3 — permission claims
    if "permission" in c["categories"]:
        roles = set(re.findall(ROLE, claim))
        if roles and not any(r in joined for r in roles):
            return "CHECK-PERMISSION", f"role token(s) {sorted(roles)} absent from the top passages"

    # R4 — comparisons are never settled by presence alone
    if "comparison" in c["categories"]:
        docs = {e["doc"] for e in ev if e["coverage"] >= 0.25}
        cenv = set(re.findall(ENV, claim))
        cscr = set(re.findall(SCREEN, claim))
        ok_env = not cenv or all(any(x in ((e["best_sentence"] or "") + (e["section"] or "")).lower()
                                     for e in ev) for x in cenv)
        if len(docs) < 2 or not ok_env:
            return "CHECK-COMPARISON", (f"{len(docs)} passage(s) >=0.25; env {sorted(cenv)}; screen {sorted(cscr)}")
        return "CHECK-COMPARISON", f"components in {len(docs)} passages — relationship still needs reading"

    # R5 — one passage carries the claim
    if ev[0]["sentence_coverage"] >= 0.70:
        return "auto-supported", f"{ev[0]['doc'][:46]} — {ev[0]['section'][:40]} (sentence cov {ev[0]['sentence_coverage']})"
    return "UNRESOLVED", f"best sentence coverage {ev[0]['sentence_coverage']}"


def run(arm):
    led = json.load(open(os.path.join(HERE, "ledger.json"), encoding="utf-8"))
    pop = L.population(led, arm)
    ids = {c["id"] for band in ("low", "partial", "high_risk", "high_sample") for c in pop[band]}
    band_of = {}
    for band in ("low", "partial", "high_risk", "high_sample"):
        for c in pop[band]:
            band_of[c["id"]] = band
    out = []
    for c in led:
        if c["id"] not in ids:
            continue
        v, why = machine(c)
        out.append({**c, "band_group": band_of[c["id"]], "machine": v, "machine_why": why})
    json.dump(out, open(os.path.join(HERE, f"verdicts-{arm}.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    tal = defaultdict(int)
    for c in out:
        tal[c["machine"]] += 1
    print(f"ARM {arm}: {len(out)} claims in the review population")
    for k, v in sorted(tal.items(), key=lambda x: -x[1]):
        print(f"   {v:>5}  {k}")
    surfaced = [c for c in out if c["machine"] != "auto-supported"]
    def norm(s):
        return re.sub(r"\W+", " ", s.lower()).strip()
    g = defaultdict(list)
    for c in surfaced:
        g[norm(c["claim"])].append(c)
    print(f"\n   surfaced for reading: {len(surfaced)} occurrences -> {len(g)} distinct claims")
    return out


def surface(arm):
    out = json.load(open(os.path.join(HERE, f"verdicts-{arm}.json"), encoding="utf-8"))
    surfaced = [c for c in out if c["machine"] != "auto-supported"]
    def norm(s):
        return re.sub(r"\W+", " ", s.lower()).strip()
    g = defaultdict(list)
    for c in surfaced:
        g[norm(c["claim"])].append(c)
    order = sorted(g.values(), key=lambda v: (v[0]["machine"], -len(v)))
    for grp in order:
        c = grp[0]
        print("\n" + "-" * 110)
        print(f"{c['machine']}  [{len(grp)}x]  {grp[0]['id']}" + (f" +{len(grp)-1} more" if len(grp) > 1 else ""))
        print(f"  ids: {', '.join(x['id'] for x in grp[:6])}{' …' if len(grp) > 6 else ''}")
        print(f"  Q: {c['question'][:140]}")
        print(f"  CLAIM: {c['claim'][:300]}")
        print(f"  why: {c['machine_why']}")
        for e in c["evidence"][:2]:
            print(f"    · {e['doc'][:58]} — {e['section'][:46]} (p.{e['page']}) cov {e['coverage']}/{e['sentence_coverage']}")
            print(f"        {e['best_sentence'][:260]}")


if __name__ == "__main__":
    cmd, arm = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("run", "F1")
    (run if cmd == "run" else surface)(arm)
