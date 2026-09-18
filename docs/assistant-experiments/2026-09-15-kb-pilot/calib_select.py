# Calibrate the excerpt-selection guard with EMBEDDINGS ONLY (no answer-model calls), owner brief 18-Sep item 4.
# Question sets used for calibration: the 57 manual-coverage cases, the 8 work-order phrasings and the 13 routing probes.
# The 10 fresh validation questions are deliberately EXCLUDED so they stay out of tuning.
#
# Variants compared (all keep routing, thresholds, excerpt count and vector order unchanged):
#   V0   vector five (served behaviour)
#   r6   lexical rescue, unconditional (the current D4)
#   r7:d lexical rescue ONLY when the rescued chunk is not materially farther than the excerpt it would displace:
#        rescued.distance <= displaced.distance + d      (d = 0.02 / 0.05 / 0.10 / 0.20)
# Reported per variant: how often the expected source is among the five, and how much nearer evidence is displaced.
import asyncio
import json
import os
import re
import sys

sys.path.insert(0, "/app")
sys.path.insert(0, "/app/indexer")
os.environ.setdefault("ASSISTANT_INDEX_SET", "kb-pilot-c")
from app import db, llm, retrieval  # noqa: E402
from app.config import settings  # noqa: E402
from acceptance_routing import CASES as ROUTING  # noqa: E402
from acceptance_wo import CASES as WOBASE, PHRASINGS  # noqa: E402

MANUAL = json.load(open("/app/indexer/manual_cases.json", encoding="utf-8"))
S = settings()
DELTAS = [0.02, 0.05, 0.10, 0.20]


def page_of(h):
    p = h.meta.get("page_number")
    try:
        return int(p)
    except Exception:
        return None


def key(h):
    return (str(h.meta.get("file")), str(h.meta.get("breadcrumb")), str(h.meta.get("chunk_index")))


def rescue(vec, lex, k, delta=None):
    five = list(vec[:k])
    if not lex:
        return five, None, None
    leader = lex[0]
    try:
        leader.meta["lex_ratio"] = (float(leader.meta.get("lexical_rank_score", 0)) / float(lex[1].meta.get("lexical_rank_score", 0))) if len(lex) > 1 and float(lex[1].meta.get("lexical_rank_score", 0)) else 99.0
    except Exception:
        leader.meta["lex_ratio"] = 0.0
    if any(key(leader) == key(h) for h in five):
        return five, None, None
    displaced = five[k - 1] if len(five) >= k else None
    if delta is not None and displaced is not None and leader.distance > displaced.distance + delta:
        return five, None, displaced          # guard blocks the swap
    out = (five[:k - 1] if len(five) >= k else five) + [leader]
    return out, leader, displaced


LEX_PER_TERM = float(os.environ.get("CAL_LEX_PER_TERM", "0.45"))
MAX_PENALTY = float(os.environ.get("CAL_MAX_PENALTY", "0.15"))
GAP = float(os.environ.get("CAL_GAP", "0.15"))


async def five_for(q, ui_module, terms, variant):
    emb = await llm.embed(q, None)
    hits = await db.search_chunks(emb, S.route_top_k)
    routed = retrieval.route(hits, q, ui_module, terms)
    if routed.gate != "answer" or not routed.module:
        return routed, [], None, None
    vec = [h for h in hits if h.module == routed.module and h.distance <= S.route_sim_floor]
    lex = [h for h in await db.search_lexical(emb, q, routed.module, S.route_top_k) if h.distance <= S.route_sim_floor]
    five, rescued, displaced = vec[: S.answer_chunks], None, None
    if variant in ("r6",):
        five, rescued, displaced = rescue(vec, lex, S.answer_chunks, None)
    elif variant in ("r7g", "r7g+r8"):
        n = len(retrieval.content_terms(q))
        five, rescued, displaced = retrieval.guarded_lexical_rescue(vec, lex, S.answer_chunks, n, LEX_PER_TERM, MAX_PENALTY)
    if variant == "r8":
        five, second, disp2 = retrieval.second_opinion(hits, routed.module, list(five), GAP, S.route_sim_floor)
        if second is not None:
            rescued, displaced = second, disp2
    if variant == "r7g+r8c":
        # r8c: among the modules whose best chunk is within GAP of the routed module's best, pick the one whose LEXICAL
        # leader is strongest per content word, and give its best vector chunk the last slot.
        best_routed = min((h.distance for h in hits if h.module == routed.module), default=None)
        cands = {}
        for h in hits:
            if h.module == routed.module or h.distance > S.route_sim_floor:
                continue
            cands.setdefault(h.module, h)
        n = max(1, len(retrieval.content_terms(q)))
        scored = []
        for mod, besthit in cands.items():
            if best_routed is None or besthit.distance > best_routed + GAP:
                continue
            lx = await db.search_lexical(emb, q, mod, 5)
            top = (float(lx[0].meta.get("lexical_rank_score", 0.0)) / n) if lx else 0.0
            scored.append((top, mod, besthit))
        if scored:
            scored.sort(reverse=True)
            top_score, mod, besthit = scored[0]
            def ident(h):
                return (str(h.meta.get("file")), str(h.meta.get("breadcrumb")), str(h.meta.get("chunk_index")))
            if all(ident(besthit) != ident(h) for h in five):
                displaced, rescued = five[-1], besthit
                five = five[:-1] + [besthit]
    return routed, five, rescued, displaced


def expected_manual(case):
    f = case["file"].rsplit(".", 1)[0]

    def pred(h):
        return str(h.meta.get("file", "")).startswith(f[:40]) and (not case["pages"] or page_of(h) in case["pages"])
    return pred


async def main():
    terms = await retrieval.title_terms()
    variants = ["V0", "r6", "r7g", "r8", "r7g+r8c"]
    swaps = []
    stats = {v: {"expected": 0, "n": 0, "swaps": 0, "nearer_displaced": 0, "dist_lost": 0.0} for v in variants}
    detail = []

    async def run(label, q, ui_module, pred):
        row = {"q": label}
        for v in variants:
            routed, five, rescued, displaced = await five_for(q, ui_module, terms, v)
            ok = any(pred(h) for h in five) if five else False
            st = stats[v]
            st["n"] += 1
            st["expected"] += ok
            if rescued is not None:
                st["swaps"] += 1
                if displaced is not None and rescued.distance > displaced.distance:
                    st["nearer_displaced"] += 1
                    st["dist_lost"] += rescued.distance - displaced.distance
            row[v] = ok
            if v == "r6" and rescued is not None and displaced is not None:
                emb2 = None
                swaps.append(f"{label:<28} lex={rescued.meta.get('lexical_rank_score', 0):.2f} "
                             f"ratio={rescued.meta.get('lex_ratio', 0):.2f} d_res={rescued.distance:.3f} "
                             f"d_disp={displaced.distance:.3f} helped={'Y' if (ok and not row.get('V0')) else ('LOST' if (row.get('V0') and not ok) else '-')}")
        detail.append(row)

    for c in MANUAL:
        await run(f"manual:{c['id']}", c["question"], c["file"].split(" - ")[0].lower(), expected_manual(c))
    wo = [(c[0], c[1], c[7]) for c in WOBASE] + list(PHRASINGS)
    for cid, q, rule in wo:
        want = "Planned work orders" if rule == "planned-auto" else "How work orders are created"
        await run(f"wo:{cid}", q, "technical", lambda h, w=want: w.lower() in str(h.meta.get("file")).lower())
    for cid, q, ctx, gate, mod, must, _ in ROUTING:
        if not must:
            continue
        await run(f"rt:{cid}", q, ctx, lambda h, ms=must: any(m.lower() in f"{h.meta.get('file')} {h.meta.get('section_title')}".lower() for m in ms))

    print("\nSWAP TABLE (r6): leader lex, leader lex / 2nd lex, leader distance, displaced distance, helped?")
    for row in swaps:
        print("   " + row)
    print(f"{'variant':<10}{'expected in five':>18}{'swaps':>8}{'swaps losing a nearer chunk':>30}{'total distance lost':>22}")
    for v in variants:
        st = stats[v]
        print(f"{v:<10}{str(st['expected']) + '/' + str(st['n']):>18}{st['swaps']:>8}{st['nearer_displaced']:>30}{st['dist_lost']:>22.3f}")
    print("\nquestions where the variants differ:")
    for row in detail:
        if len({row[v] for v in variants}) > 1:
            print("  " + f"{row['q']:<28}" + "  ".join(f"{v}={'Y' if row[v] else 'n'}" for v in variants))
    json.dump(detail, open("/out/calib-select.json", "w", encoding="utf-8"), indent=1)


asyncio.run(main())
