# Bounded routing experiment — analysis. Offline, deterministic, no model calls.
#
#   python analyse.py            # table over all 101 captured questions
#   python analyse.py --case manuals/hist-1
#
# Reproduces the SHIPPED decision from the captured candidates (route() sees exactly route_top_k=10 hits;
# excerpt selection draws from those same 10), then applies each candidate rule to the identical input.
#
# Outcomes are reported as THREE separate counts, never two, as the reviewer required:
#     correct-module answer · clarify · wrong-module answer   (+ not_documented, reported separately)
# and, on the cases that name an expected document, whether the expected document's passage is actually
# among the supplied excerpts. A rule that fixes the module but never supplies the passage has not helped.
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
CAND = json.loads((HERE / "candidates.json").read_text(encoding="utf-8"))
META = json.loads((HERE / "meta.json").read_text(encoding="utf-8"))
S = META["settings"]
FLOOR, MARGIN, TOPK, NCHUNK = S["route_sim_floor"], S["route_margin"], S["route_top_k"], S["answer_chunks"]


def ident(h: dict) -> tuple:
    return (h["file"], h["breadcrumb"], h["chunk_index"])


def route(hits: list[dict], named: str | None, ui_module: str | None,
          intent_on: bool = True, margin_thr: float = MARGIN) -> tuple[str, str | None, float, str]:
    """app.retrieval.route(), reproduced. Returns (gate, module, margin, reason)."""
    if not hits or hits[0]["distance"] > FLOOR:
        return "not_documented", None, 0.0, "beyond floor"
    best: dict[str, float] = {}
    for h in hits:
        if h["distance"] <= FLOOR and (h["module"] not in best or h["distance"] < best[h["module"]]):
            best[h["module"]] = h["distance"]
    ranked = sorted(best.items(), key=lambda kv: kv[1])
    top_module, top_dist = ranked[0]
    margin = (ranked[1][1] - top_dist) if len(ranked) > 1 else 1.0
    reason = "vector routing"
    if intent_on:
        if named and named in best:
            top_module, reason, margin = named, "explicit module name", 1.0
        elif margin < margin_thr and ui_module and ui_module in {m for m, _ in ranked[:3]}:
            top_module, reason, margin = ui_module, "UI context broke a clarify tie", margin_thr
    if margin < margin_thr:
        return "clarify", None, margin, reason
    return "answer", top_module, margin, reason


def excerpts(hits: list[dict], lex: list[dict], module: str, n_terms: int) -> list[dict]:
    """The excerpts the answer model receives: vector selection inside the routed module, then the
    guarded lexical rescue (ASSISTANT_HYBRID=rescue), reproduced from app.retrieval."""
    five = [h for h in hits if h["module"] == module and h["distance"] <= FLOOR][:NCHUNK]
    cand = [h for h in lex if h["module"] == module and h["distance"] <= FLOOR]
    if not cand or not five:
        return five
    leader = cand[0]
    if any(ident(leader) == ident(h) for h in five):
        return five
    displaced = five[NCHUNK - 1] if len(five) >= NCHUNK else None
    if n_terms > 0 and (leader.get("lex", 0.0) / n_terms) < S["rescue_lex_per_term"]:
        return five
    if displaced is not None and leader["distance"] > displaced["distance"] + S["rescue_max_penalty"]:
        return five
    return (five[:NCHUNK - 1] if len(five) >= NCHUNK else five) + [leader]


def second_opinion(all_hits: list[dict], module: str, five: list[dict], gap: float) -> list[dict]:
    """app.retrieval.second_opinion() — the runner-up module's nearest chunk takes the last slot when the
    module decision was close. Already in the shipped code; disabled by default (gap 0)."""
    if gap <= 0 or not five:
        return five
    routed_best = min((h["distance"] for h in all_hits if h["module"] == module), default=None)
    other = [h for h in all_hits if h["module"] != module and h["distance"] <= FLOOR]
    if routed_best is None or not other:
        return five
    cand = min(other, key=lambda h: h["distance"])
    if cand["distance"] > routed_best + gap or any(ident(cand) == ident(h) for h in five):
        return five
    return five[:-1] + [cand]


def module_scores(hits: list[dict], lex: list[dict], alpha: float) -> dict[str, float]:
    """Rule C's joint score. The reviewer's point 4: a rule must say HOW the two channels combine, or the
    lexical channel simply replaces one wrong winner with another (for hist-1 the lexical leader is
    Incident, not Audit). Both channels are normalised to 0..1 and mixed convexly, per module:
        vector  : 1 - best_distance / floor        (nearest chunk of that module, inside the floor)
        lexical : best lexical score of that module / best lexical score overall
    Only modules with a candidate inside the floor can score at all, so the floor still gates everything."""
    vec: dict[str, float] = {}
    for h in hits:
        if h["distance"] <= FLOOR:
            vec[h["module"]] = max(vec.get(h["module"], 0.0), 1.0 - h["distance"] / FLOOR)
    lx: dict[str, float] = {}
    for h in lex:
        if h["distance"] <= FLOOR:
            lx[h["module"]] = max(lx.get(h["module"], 0.0), float(h.get("lex", 0.0)))
    top = max(lx.values(), default=0.0) or 1.0
    return {m: alpha * v + (1 - alpha) * (lx.get(m, 0.0) / top) for m, v in vec.items()}


def classify(gate: str, module: str | None, expected: str) -> str:
    if gate == "clarify":
        return "clarify"
    if gate == "not_documented":
        return "not_documented"
    return "correct" if module == expected else "wrong"


def supplied_expected(five: list[dict], expected_file: str | None) -> bool | None:
    if not expected_file:
        return None
    return any(h["file"] == expected_file for h in five)


RULES = [
    ("R0  current (shipped f1 config)", dict(kind="current")),
    ("R1a second opinion, gap 0.10", dict(kind="second", gap=0.10)),
    ("R1b second opinion, gap 0.15", dict(kind="second", gap=0.15)),
    ("R1c second opinion, gap 0.25", dict(kind="second", gap=0.25)),
    ("R2a clarify when runner-up within 0.10", dict(kind="clarify_guard", gap=0.10)),
    ("R2b clarify when runner-up within 0.15", dict(kind="clarify_guard", gap=0.15)),
    ("R3a joint vector+lexical module score, alpha 0.7", dict(kind="joint", alpha=0.7, thr=0.02)),
    ("R3b joint vector+lexical module score, alpha 0.5", dict(kind="joint", alpha=0.5, thr=0.02)),
    ("R4  UI context outranks vector routing", dict(kind="ui_first")),
    ("R5a evidence not module-scoped (global top 5)", dict(kind="unscoped")),
    ("R5b per-module second opinion, gap 0.15", dict(kind="per_module", gap=0.15, extra=1)),
    ("R5c per-module second opinion, gap 0.25", dict(kind="per_module", gap=0.25, extra=2)),
]


def run_rule(case: dict, rule: dict) -> tuple[str, list[dict], str]:
    hits = case["vector_topk"][:TOPK]
    lex = case["lexical_topk"]
    named = META["explicit_module"][case["id"]]["named"]
    ui = case.get("ui_module")
    kind = rule["kind"]

    if kind == "ui_first":
        inside = {h["module"] for h in hits if h["distance"] <= FLOOR}
        if ui and ui in inside:
            five = excerpts(hits, lex, ui, case["n_content_words"])
            return "answer", five, ui
    if kind == "joint":
        sc = module_scores(hits, lex, rule["alpha"])
        if not sc:
            return "not_documented", [], ""
        order = sorted(sc.items(), key=lambda kv: -kv[1])
        if named and named in sc:
            top = named
        else:
            top = order[0][0]
            if len(order) > 1 and (order[0][1] - order[1][1]) < rule["thr"]:
                return "clarify", [], ""
        return "answer", excerpts(hits, lex, top, case["n_content_words"]), top

    gate, module, _margin, _reason = route(hits, named, ui)
    if gate != "answer":
        return gate, [], ""
    five = excerpts(hits, lex, module, case["n_content_words"])
    if kind == "second":
        five = second_opinion(hits, module, five, rule["gap"])
    if kind == "unscoped":
        # The module decision still labels the answer, but the evidence is the global nearest set. This
        # targets the mechanism the capture actually shows: the right passage is a live in-floor candidate
        # and is discarded only because it belongs to another module.
        five = [h for h in hits if h["distance"] <= FLOOR][:NCHUNK]
    if kind == "per_module":
        # second_opinion() takes min(other) — the single nearest non-routed chunk, which for hist-1 is
        # Safety, not the Audit page. This variant offers the nearest chunk of EACH other module inside
        # the gap, bounded by `extra` slots.
        routed_best = min((h["distance"] for h in hits if h["module"] == module), default=99.0)
        per: dict[str, dict] = {}
        for h in hits:
            if h["module"] != module and h["distance"] <= min(FLOOR, routed_best + rule["gap"]):
                if h["module"] not in per or h["distance"] < per[h["module"]]["distance"]:
                    per[h["module"]] = h
        add = [h for h in sorted(per.values(), key=lambda x: x["distance"])
               if not any(ident(h) == ident(f) for f in five)][: rule["extra"]]
        if add:
            five = five[: max(0, NCHUNK - len(add))] + add
    if kind == "clarify_guard":
        routed_best = min((h["distance"] for h in hits if h["module"] == module), default=99.0)
        other = [h["distance"] for h in hits if h["module"] != module and h["distance"] <= FLOOR]
        if other and min(other) <= routed_best + rule["gap"]:
            return "clarify", [], ""
    return "answer", five, module


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--case")
    args = ap.parse_args()
    cases = [c for c in CAND["cases"] if not args.case or c["id"] == args.case]

    if args.case:
        for c in cases:
            detail(c)
        return

    print(f"index {CAND['index_set']} · {len(cases)} questions · floor {FLOOR} · margin {MARGIN} "
          f"· top_k {TOPK} · excerpts {NCHUNK}")
    print(f"{'rule':<46} {'correct':>8} {'clarify':>8} {'wrong':>7} {'not-doc':>8}   "
          f"{'passage supplied':>16}  {'excerpt slots changed':>21}")
    print("-" * 124)
    base = {c["id"]: run_rule(c, RULES[0][1])[1] for c in cases}
    for label, rule in RULES:
        tally = {"correct": 0, "clarify": 0, "wrong": 0, "not_documented": 0}
        sup = tot = changed = slots = 0
        for c in cases:
            gate, five, module = run_rule(c, rule)
            tally[classify(gate, module, c["expected_module"])] += 1
            got = supplied_expected(five, c.get("expected_file"))
            if got is not None:
                tot += 1
                sup += 1 if got else 0
            was = {ident(h) for h in base[c["id"]]}
            now = {ident(h) for h in five}
            changed += len(was - now)
            slots += len(was)
        pct = f"{100 * changed / slots:.0f}%" if slots else "-"
        print(f"{label:<46} {tally['correct']:>8} {tally['clarify']:>8} {tally['wrong']:>7} "
              f"{tally['not_documented']:>8}   {sup:>5} of {tot:<8}  {changed:>8} of {slots} ({pct})")

    print("\nCASES THE CURRENT RULE GETS WRONG (module != expected):")
    for c in cases:
        gate, five, module = run_rule(c, RULES[0][1])
        if classify(gate, module, c["expected_module"]) == "wrong":
            best = c["module_best"].get(c["expected_module"], {})
            print(f"  {c['id']:<26} expected {c['expected_module']:<10} got {module:<10} "
                  f"| expected module nearest {best.get('distance', float('nan')):.4f} "
                  f"({'inside' if best.get('distance', 9) <= FLOOR else 'outside'} floor) p.{best.get('page')}")


def detail(c: dict) -> None:
    named = META["explicit_module"][c["id"]]["named"]
    print(f"{c['id']}  expected={c['expected_module']}  ui_context={c.get('ui_module')}  "
          f"names_module={named or '-'} ({META['explicit_module'][c['id']]['why']})")
    print(f"Q: {c['question']}\n")
    print("  nearest chunk per module, whole corpus:")
    for m, v in sorted(c["module_best"].items(), key=lambda kv: kv[1]["distance"]):
        mark = "inside floor" if v["distance"] <= FLOOR else "OUTSIDE floor"
        print(f"    {m:<10} {v['distance']:.4f}  {mark}  p.{v['page']}  {str(v['section'])[:46]}")
    print("\n  vector top-10 (exactly what route() sees):")
    for i, h in enumerate(c["vector_topk"][:TOPK], 1):
        print(f"    {i:>2} {h['module']:<10} {h['distance']:.4f}  p.{h['page']}  {str(h['section'])[:46]}")
    print("\n  lexical top-5, unscoped, from the question's own words:")
    for i, h in enumerate(c["lexical_topk"][:5], 1):
        print(f"    {i:>2} {h['module']:<10} lex {h.get('lex', 0):.4f}  d {h['distance']:.4f}  "
              f"p.{h['page']}  {str(h['section'])[:42]}")
    print()
    for label, rule in RULES:
        gate, five, module = run_rule(c, rule)
        verdict = classify(gate, module, c["expected_module"])
        got = supplied_expected(five, c.get("expected_file"))
        extra = "" if got is None else ("  expected passage SUPPLIED" if got else "  expected passage absent")
        print(f"    {label:<46} {verdict:<14} module={module or '-'}{extra}")


if __name__ == "__main__":
    main()
