"""
Work-order creation regression cases (owner item 1, 14-Sep-2026) — SEPARATE from the frozen suites.
The generic question must explain the verified alternatives without assuming "unplanned":
planned work orders are generated from the job schedule (ship daily scan; office only Sail Admin +
vessel switch), a work order can be generated for a specific job from Components (with the same
office conditions), and an unplanned work order is created with '+ Unplanned W.O'. Citations:
official PMS manual for manual-backed steps, the code-derived Recent Updates document for the
implementation details the June manuals lack.

  IDENTITY_SIGNING_KEY=... python indexer/acceptance_wo.py --repeat 3 --set base=http://127.0.0.1:8016 --set cand=http://127.0.0.1:8018
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx2 as httpx  # noqa: E402
from acceptance_answers import ask, judge  # noqa: E402

# .2 (after run E, reported): .1 was satisfied by "Sail Admin" inside the manual's FILE NAME in the Source line while the
#     answer body stated no office condition at all (3/3 runs). The judge now checks the answer BODY (text before the
#     "Source" line) and requires the office condition words there; run E's 2/2 under .1 is therefore NOT a true pass.
# .3 (owner decisions 14-Sep): PER-ACTION pairing — the block that describes 'Generate Now' must carry BOTH the Sail Admin
#     role and the vessel switch; the block that describes the per-job 'Generate WO' must carry the vessel switch and must
#     NOT attach the Sail Admin role (the code has no role check on that path); a role attached to the wrong action fails.
#     Added wo-generic-03 = the phrasing that ranked the new section 6th ("How to create work order in PMS?").
# .4 (owner, 15-Sep, KB-pilot step 3): (a) "created automatically" accepted as automatic generation; (b) wo-generic-02
#     re-scoped to the question asked — automatic generation + "you do not create them"; the Generate Now pairing is
#     checked ONLY if the answer describes Generate Now; (c) wo-phr-02 ("raise a work order for a pump") expects the
#     unplanned procedure plus a one-line note of the other ways. JUDGE_VERSION selects 3 or 4 so old and new scores
#     can be shown on the same stored answers (rejudge_wo.py).
# .5 (owner GO, 15-Sep, after external review): per-action ATTRIBUTION rebuilt. .3/.4 split the answer into blocks only at
#     bold/markdown headings or blank lines, so an answer written as "1. … 2. … 3. …" (inline, or one item per line) was ONE
#     block and a condition stated for 'Generate Now' satisfied the 'Generate WO' check (D2 wo-phr-03 run 3: per-job switch
#     missing, judge said "pairing ✓"). .5 segments the body into units (line breaks, "N." enumerators at line start or
#     inline — section numbers such as 1.1.5.2 excluded —, "- " bullets, sentence ends) and builds ACTION SCOPES: a unit
#     naming an action opens that action's scope; following units that name no action belong to the open scope (sub-bullet
#     conditions stay with their action); a unit naming another action closes it. Conditions are then checked inside the
#     scope of the action they belong to — never across the whole answer. Limitation (reported, not hidden): a condition
#     stated in a unit BEFORE the first action unit belongs to no scope and does not count.
# .6 (owner GO, 15-Sep, second review): (a) equivalent automatic-generation wording accepted — any sentence that pairs
#     generate/create with automatic(ally) ("the system generates them automatically", "automatically created by the ship
#     system"); (b) environment + prerequisite checked TOGETHER per action: the per-job 'Generate WO' switch must be stated
#     as an OFFICE condition ("switch required" alone = incorrect applicability, because the ship path has no switch);
#     'Generate Now' must be placed in the office; the unplanned scope must not carry a switch or Sail Admin requirement.
#     Reported as substantive defects ("missing prerequisite" / "incorrect applicability"), never as wording.
# .7 (reviewer + owner, 15-Sep, before the v5 replay): FORMAT-AWARE PARSING ONLY — the acceptance requirements of .6 are
#     unchanged. (a) `body_of` no longer cuts the answer at the first "Source:" line: every source line / "(Source: …)"
#     parenthetical is removed wherever it sits (per-method source lines of the v4/v5 format kept truncating the body);
#     (b) scopes are built from METHOD BLOCKS: a block (heading + its lines) that names one action is attributed whole to that
#     action, so a requirements line written before the step that names the action is no longer lost; a heading block that
#     names no action is held and attached to the NEXT action it introduces (not the previous one); a block naming several
#     actions falls back to the .5 unit scoping inside the block. Validated on 132 stored answers before use.
# .8 (owner rule, 15-Sep, after reading the v5 answers): PARSING ONLY — an Office label that governs an entire procedure
#     ('- Office: Select the vessel → … click Generate WO → … the switch must be ON') qualifies that procedure's conditions;
#     an Office label attached only to vessel selection ('- Office: Select the vessel.' as its own step) cannot. Factual
#     requirements unchanged. Validated on the stored answers before use.
# .9 (reviewer + owner, 15-Sep, after the luna suites): PARSING ONLY — (a) a requirements/bullet block that names no action
#     and follows a HELD heading (the heading was separated from it by a blank line) is attached to the heading's action,
#     not to the previous one; (b) the "Sail Admin wrongly attached to Generate WO" check reads the scope with manual file
#     names removed ('…For Office_Sail Admin…' quoted in a per-method source bullet is not a role). Validated on all stored
#     answers before use; factual requirements unchanged.
# .10 (15-Sep, after the three-set run): PARSING ONLY — the unplanned "wrongly requires the switch" check missed negations
#      that sit more than 40 characters before the word ("no special role check or vessel-generation switch is required") and
#      negations AFTER it ("switch is not required", "no … switch requirement"); the window is now 90 characters before and
#      a trailing "not required / no … requirement" also negates. Validated on all stored answers before use.
# .11 (15-Sep): PARSING ONLY — a bare mention of the switch inside the unplanned scope is only a "requirement" when the same
#      sentence carries requirement wording (must / require / need / only if / only when / has to) and no negation; the v5
#      source-comparison sentences ("the office-switch details come from draft code-derived guidance", "the manuals do not state
#      the role or switch conditions") were being read as conditions attached to the unplanned procedure.
WO_SUITE_VERSION = "2026-09-14.11"
JUDGE_VERSION = 12
NOT_COVERED = ["not covered", "isn't covered", "not documented", "does not cover", "no information"]
# (id, question, module, expected manual substring (any Technical source), pages, must ALL, must_not, extra rule, source)
CASES = [
    ("wo-generic-01", "How do I create a work order?", "technical", "Technical", None,
     ["unplanned w.o", "generate wo"], NOT_COVERED, "three-paths",
     "PMS Office p28 §1.1.5.1 (Scheduled = jobs planned with a future due date), p18 (Components Part C 'Generate WO' with a reason), p29 §1.1.5.2 ('+ Unplanned W.O'); Recent Updates R3.2 §1.1.14.13 (ship daily scan; office = Sail Admin AND vessel switch, for Generate Now and per-job Generate WO)."),
    ("wo-generic-02", "How are planned work orders created in PMS — do I have to create them myself?", "technical", "Technical", None,
     ["job"], NOT_COVERED, "planned-auto",
     "Recent Updates R3.2 §1.1.14.13: generated from the job schedule by the ship's daily scan; office generation only by a Sail Admin with the vessel switch on."),
    ("wo-generic-03", "How to create work order in PMS?", "technical", "Technical", None,
     ["unplanned w.o", "generate wo"], NOT_COVERED, "three-paths",
     "Same expectation as wo-generic-01; this phrasing ranked the new section 6th (outside the 5 excerpts) in the rank probe of 14-Sep."),
]


# Five fresh phrasings of the generic question (owner, 15-Sep-2026, KB-pilot step 6). Run with --phrasings. They use
# the SAME three-paths judge as wo-generic-01 (no judge change) and the same all-runs rule.
PHRASINGS = [
    ("wo-phr-01", "What are the different ways to create a work order in PMS?", "three-paths"),
    ("wo-phr-02", "I need to raise a work order for a pump — how do I do that?", "unplanned-plus-note"),  # .4: expected = unplanned procedure + one-line note of the other ways
    ("wo-phr-03", "Do I create work orders myself or does the system create them?", "three-paths"),
    ("wo-phr-04", "Steps to create a new work order", "three-paths"),
    ("wo-phr-05", "How do work orders get created in the Technical module?", "three-paths"),
]
AUTO_V3 = r"(generated automatically|automatically generat|daily scan|from the job schedule|job schedule|from the job'?s schedule|scheduled work orders? (are|is) (generated|created))"
AUTO_V4 = AUTO_V3[:-1] + r"|created automatically|automatically creat)"
# .6: generate/create and automatic(ally) in the same sentence, either order ("the system generates them automatically")
AUTO_V6 = AUTO_V4[:-1] + r"|(generat|creat)\w*[^.\n]{0,80}automatic|automatic\w*[^.\n]{0,80}(generat|creat))"
NEG_RE = r"(no|not|without|does not require|doesn't require|no need for|not required|nor)\b[^.\n]{0,40}$"


def unit_has_office_qualifier(scope: str, word: str = "switch", action_re: str = r"generate wo", version: int = JUDGE_VERSION) -> bool:
    """.6: the switch must be stated as an OFFICE condition — 'office' in the same unit (sentence/item) as `word`, or the
    action itself framed 'in the office' in the scope's first unit. The step parenthetical '(Office: select the vessel)' and
    manual file names ('For Office_Sail Admin') do not count as a qualifier.
    .8 (owner rule 15-Sep): an Office label that governs the ENTIRE procedure qualifies its conditions — a unit that opens with
    'office:' / 'in the office' AND contains the action itself ('Office: select the vessel → … click Generate WO …') — while an
    Office label attached only to vessel selection ('- Office: Select the vessel.' as its own step) cannot."""
    clean = re.sub(r"\(office:[^)]*\)|for office_sail admin[^\s,;.)]*", "", scope)
    units = units_of(clean)
    if not units:
        return False
    # the action's framing sentence = the first unit that is not a bare heading (.7 scopes start with the method heading)
    first = next((u for u in units if not re.match(r"^\s*(?:\d+\.|(?:\d+\.\s*)?\*\*[^*]{0,80}\*\*\s*:?)\s*$", u)), units[0])
    framed = "in the office" in first
    if version >= 8 and not framed:
        # a whole-procedure Office label: the unit that carries the action starts with the label
        framed = any(re.match(r"^\s*(?:-\s*)?(?:in the office|office)\s*[:—–-]", u) and re.search(action_re, u) for u in units)
    hits = [u for u in units if word in u]
    return bool(hits) and all(("office" in u) or framed for u in hits)


def wrongly_conditioned(scope: str, word: str, version: int = JUDGE_VERSION) -> bool:
    """.6: `word` appears in the scope as a requirement (not negated: 'no switch', 'without a switch', 'no role check or switch');
    the manual file name 'For Office_Sail Admin_R2…' quoted in the body is not a requirement.
    .10: negation window 90 chars before the word (was 60/40) and a trailing negation counts ('switch is not required',
    'no … switch requirement', 'switch requirement', 'switch is needed' preceded by 'no')."""
    clean = re.sub(r"for office_sail admin[^\s,;.)]*", "", scope)
    win = 90 if version >= 10 else 60
    neg = r"(no|not|without|does not require|doesn't require|no need for|not required|nor|neither)\b[^.\n]{0,80}$" if version >= 10 else NEG_RE
    if version >= 11:
        # .11: judge sentence by sentence — a mention counts as a requirement only when the sentence carries requirement wording
        for sent in re.split(r"(?<=[.!?])\s+|\n+", clean):
            if word not in sent:
                continue
            if not re.search(r"\b(must|require[sd]?|requirement|needs?|needed|only if|only when|has to|have to|mandatory)\b", sent):
                continue
            if re.search(r"\b(no|not|without|nor|neither|n't)\b", sent):
                continue
            return True
        return False
    for m in re.finditer(word, clean):
        before = clean[max(0, m.start() - win): m.start()]
        after = clean[m.end(): m.end() + 40]
        if re.search(neg, before):
            continue
        if version >= 10 and re.match(r"\s*(requirement|is|are|was)?\s*(is |are )?(not|no)\b", after):
            continue
        return True
    return False


def body_of(text: str, version: int = 6) -> str:
    """The answer without its Source line(s) — file names such as '…For Office_Sail Admin…' must not satisfy content checks.
    ≤ .6: cut at the FIRST line starting with 'Source:' (truncates formats with one source line per method).
    .7: remove every source line ('Source:', '— Source:', '**Source:**') and every '(Source: …)' parenthetical wherever it sits."""
    if version >= 7:
        t = re.sub(r"\(\s*source\s*:[^)]*\)", "", text, flags=re.I)
        t = re.sub(r"^[ \t]*(?:[—–-]\s*)?\**\s*source\s*\**\s*:.*$", "", t, flags=re.I | re.M)
        return t.lower()
    return re.split(r"\n\s*\*{0,2}source\*{0,2}\s*:", text, flags=re.I)[0].lower()


def blocks_of(body: str) -> list[str]:
    """Split the answer body into per-action blocks: numbered/bold headings or blank-line paragraphs."""
    parts = re.split(r"\n(?=\s*(?:\d+\.\s*\*\*|\*\*|\d+\.\s+\*\*|- \*\*|#{1,4}\s)|\n\s*\n)", body)
    return [p.strip() for p in parts if p.strip()]


def block_for(body: str, keyword_re: str) -> str:
    """The block(s) that describe one action (joined), or '' if the action is not described."""
    return "\n".join(b for b in blocks_of(body) if re.search(keyword_re, b))


GN_RE = r"generate now"
GW_RE = r"generate wo\b|generate wo'|'generate wo|generate work order for|specific job"
UN_RE = r"unplanned"
PL_RE = r"planned \(scheduled\)|scheduled work order|generated automatically|created automatically|automatically generat|automatically creat|daily scan"
ACTIONS = [("GN", GN_RE), ("GW", GW_RE), ("UN", UN_RE), ("PL", PL_RE)]
_UNIT_SPLIT = re.compile(
    r"\n+"                                              # line breaks
    r"|(?<![\d.])(?<=\s)(?=\d{1,2}\.\s\S)"              # inline "N. " enumerator (not 1.1.5.2, not after a digit/dot)
    r"|(?<=\s)(?=- )"                                   # "- " bullet
    r"|(?<=[.!?])\s+(?=\S)"                             # sentence end
)


def units_of(body: str) -> list[str]:
    """Judge .5 segmentation: units = enumerated items (line-start or inline), bullets, lines, sentences."""
    return [u.strip() for u in _UNIT_SPLIT.split(body) if u and u.strip()]


def scopes_of(body: str) -> dict[str, str]:
    """Judge .5: action scopes. Each unit naming an action opens that action's scope (units naming several actions are
    added to every one of them); units naming no action are appended to the currently open scope. Returns action → text."""
    scopes: dict[str, list[str]] = {a: [] for a, _ in ACTIONS}
    current: list[str] = []
    for u in units_of(body):
        named = [a for a, pat in ACTIONS if re.search(pat, u)]
        if named:
            current = named
        for a in current:
            scopes[a].append(u)
    return {a: " ".join(v) for a, v in scopes.items()}


_BLOCK_SPLIT = re.compile(r"\n(?=\s*(?:\d+\.\s|\*\*|#{1,4}\s|- \*\*|method \d))|\n\s*\n")
_HEADING_RE = re.compile(r"^\s*(?:\*\*|\d+\.\s*\*\*|method \d|\d+\.\s+[a-z][^.]{0,80}(?:—|:)\s*$)")


def scopes_v7(body: str, version: int = 7) -> dict[str, str]:
    """Judge .7: method-block scopes. Blocks = numbered/bold/heading lines and blank-line paragraphs. A block naming exactly one
    action goes whole to that action (its requirements line included, wherever it sits); a block naming several actions is
    scoped by units inside the block (.5); a block naming none goes to the open action(s) — unless it looks like a heading,
    in which case it is held and attached to the next action(s) it introduces.
    .9: while a heading is held, a following block that names no action (its requirements bullets, separated from the heading
    by a blank line) travels WITH the held heading to the next action instead of falling back to the previous one."""
    scopes: dict[str, list[str]] = {a: [] for a, _ in ACTIONS}
    current: list[str] = []
    pending: list[str] = []
    for blk in (b.strip() for b in _BLOCK_SPLIT.split(body) if b and b.strip()):
        named = [a for a, pat in ACTIONS if re.search(pat, blk)]
        if not named:
            if _HEADING_RE.match(blk) or not current or (version >= 9 and pending):
                pending.append(blk)
            else:
                for a in current:
                    scopes[a].append(blk)
            continue
        if len(named) == 1:
            current = named
            for a in current:
                scopes[a].extend(pending + [blk])
            # .12: a block that names one action may END with a lead-in sentence introducing ANOTHER action's steps
            # ("In the office, planned work orders are not generated automatically. A Sail Admin can:"). That trailing
            # sentence belongs to what follows, not to the action just named, so it travels forward as well.
            if version >= 12:
                tail = blk.rstrip()
                if tail.endswith(":"):
                    lead = re.split(r"(?<=[.!?])\s+", tail)[-1]
                    if lead and not any(re.search(pat, lead) for _a, pat in ACTIONS):
                        pending = [lead]
                        continue
        else:  # several actions in one block: unit-level attribution inside it, heading text goes to all of them
            inner = scopes_of(blk)
            for a in named:
                scopes[a].extend(pending + [inner[a]])
            current = named
        pending = []
    return {a: " ".join(v) for a, v in scopes.items()}


def check_pairing(body: str, version: int = JUDGE_VERSION) -> tuple[bool, str]:
    """Per-action permission pairing (suite .3; attribution rebuilt in .5; method-block scopes in .7):
       Generate Now  → must state Sail Admin AND the vessel switch in ITS scope
       Generate WO   → must state the vessel switch in ITS scope and must NOT attach Sail Admin there"""
    un = ""
    if version >= 7:
        sc = scopes_v7(body, version)
        gn, gw, un = sc["GN"], sc["GW"], sc["UN"]
    elif version >= 5:
        sc = scopes_of(body)
        gn, gw, un = sc["GN"], sc["GW"], sc["UN"]
    else:
        gn = block_for(body, GN_RE)
        gw = block_for(body, GW_RE)
    notes: list[str] = []
    if not gn:
        notes.append("Generate Now not described")
    else:
        if "sail admin" not in gn:
            notes.append("Generate Now block lacks Sail Admin [missing prerequisite]")
        if "switch" not in gn:
            notes.append("Generate Now block lacks the vessel switch [missing prerequisite]")
        if version >= 6 and "office" not in gn:
            notes.append("Generate Now not placed in the office [incorrect applicability]")
    if not gw:
        notes.append("per-job Generate WO not described")
    else:
        if "switch" not in gw:
            notes.append("Generate WO block lacks the vessel switch [missing prerequisite]")
        elif version >= 6 and not unit_has_office_qualifier(gw, "switch", GW_RE, version):
            notes.append("Generate WO switch stated without the office qualifier [incorrect applicability]")
        gw_role = re.sub(r"for office_sail admin[^\s,;.)]*", "", gw) if version >= 9 else gw  # .9: a quoted manual file name is not a role
        if "sail admin" in gw_role and "generate now" not in gw_role:
            notes.append("Sail Admin wrongly attached to Generate WO [incorrect applicability]")
    if version >= 6 and un:
        if wrongly_conditioned(un, "switch", version):
            notes.append("unplanned wrongly requires the switch [incorrect applicability]")
        if wrongly_conditioned(un, "sail admin", version):
            notes.append("unplanned wrongly requires Sail Admin [incorrect applicability]")
    ok = not notes
    return ok, ("pairing ✓" if ok else "pairing ✗: " + "; ".join(notes))


def extra_rule(rule: str, text: str, version: int = JUDGE_VERSION) -> tuple[bool, str]:
    t = body_of(text, version)
    auto_re = AUTO_V6 if version >= 6 else (AUTO_V4 if version >= 4 else AUTO_V3)
    if rule == "three-paths":
        auto = bool(re.search(auto_re, t))
        pair_ok, pair_why = check_pairing(t, version)
        return auto and pair_ok, ("automatic generation " + ("✓" if auto else "MISSING") + "; " + pair_why)
    if rule == "planned-auto":
        auto = bool(re.search(r"(automatic|daily scan|generated (by|from)|from the job)", t))
        if version <= 3:
            gn = block_for(t, r"generate now") or t
            office = ("sail admin" in gn) and ("switch" in gn)
            return auto and office, "automatic generation " + ("✓" if auto else "MISSING") + "; Generate Now conditions (Sail Admin + switch) " + ("✓" if office else "MISSING")
        # v4: scope = the question asked (how planned WOs are created; must I create them?)
        no_user = bool(re.search(r"(do not have to|don't have to|no user action|not required|no action|does not require|nobody|by the system|by the ship system|automatically)", t))
        gn = scopes_v7(t, version)["GN"] if version >= 7 else (scopes_of(t)["GN"] if version >= 5 else block_for(t, r"generate now"))
        pairing_ok = True
        note = ""
        if gn:  # only judged when the answer chose to describe Generate Now
            pairing_ok = ("sail admin" in gn) and ("switch" in gn)
            note = "; Generate Now described with its conditions " + ("✓" if pairing_ok else "✗ (Sail Admin + switch missing)")
        return auto and no_user and pairing_ok, "automatic generation " + ("✓" if auto else "MISSING") + "; user need not create " + ("✓" if no_user else "MISSING") + note
    if rule == "unplanned-plus-note":
        unplanned = "unplanned w.o" in t and ("submit work order" in t or "part b" in t)
        note = bool(re.search(r"(generate wo|generated automatically|automatically|(?<!un)planned work order|scheduled work order|other ways|generate now)", t))
        return unplanned and note, "unplanned procedure " + ("✓" if unplanned else "MISSING") + "; note of the other ways " + ("✓" if note else "MISSING")
    return True, ""


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True)
    ap.add_argument("--repeat", type=int, default=1)
    ap.add_argument("--dump", default=None)
    ap.add_argument("--phrasings", action="store_true", help="also run the five fresh phrasings of the generic question (same judge as wo-generic-01)")
    args = ap.parse_args()
    key = os.environ["IDENTITY_SIGNING_KEY"]
    sets = [(s.partition("=")[0], s.partition("=")[2]) for s in args.set]
    dump = open(args.dump, "w", encoding="utf-8") if args.dump else None  # noqa: SIM115
    cases = list(CASES)
    if args.phrasings:
        base = CASES[0]
        cases += [(cid, q, base[2], base[3], base[4], (["unplanned w.o"] if rule == "unplanned-plus-note" else base[5]), base[6], rule, "fresh phrasing (rule " + rule + ")") for cid, q, rule in PHRASINGS]
    score = dict.fromkeys([n for n, _ in sets], 0)
    print(f"work-order suite {WO_SUITE_VERSION} · {len(cases)} cases · repeat={args.repeat}")
    async with httpx.AsyncClient(timeout=150.0) as c:
        for cid, q, module, manual, page, must, must_not, rule, _src in cases:
            print(f"\n[{cid}] {q}")
            runs = [await asyncio.gather(*(ask(c, u, key, q, module) for _, u in sets)) for _ in range(args.repeat)]
            for si, (n, _) in enumerate(sets):
                votes = []
                for r in range(args.repeat):
                    a, ct, _at, detail = judge(runs[r][si], manual, page, must, must_not, "gen")
                    ok_extra, why = extra_rule(rule, runs[r][si].get("response") or "")
                    votes.append(a and ct and ok_extra)
                    if dump:
                        dump.write(json.dumps({"suite": "wo", "case": cid, "set": n, "run": r + 1, "verdict": {"answer": a, "citation": ct, "rule": ok_extra, "why": why}, "response": runs[r][si]}, ensure_ascii=False) + "\n")
                    if r == 0:
                        print(f"   {n:<14} answer {'✓' if a else '✗'}  cite {'✓' if ct else '✗'}  rule {'✓' if ok_extra else '✗'} ({why})  {detail}")
                ok = sum(votes) == len(votes)  # owner rule (.3): required conditions must survive ALL runs — no majority vote here
                score[n] += ok
                print(f"   {n:<14} PASS {'✓' if ok else '✗'} [{sum(votes)}/{len(votes)} — all runs required]")
    print("\n== totals ==")
    for n, _ in sets:
        print(f"   {n:<14} {score[n]}/{len(cases)}")
    if dump:
        dump.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
