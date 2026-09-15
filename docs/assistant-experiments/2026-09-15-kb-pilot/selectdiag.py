# Embedding-only comparison of excerpt-selection variants on top of the SAME routing (intent routing on = D1 behaviour).
# No answer model is called. For every suite question: is the expected source chunk among the five excerpts, and how many of
# the vector five (served behaviour) survive. Variants: V0 vector five (D1) · r5 convex fusion a=0.5 over the lexical top-10 (D2)
# · VA convex a=0.5 with the lexical score of EVERY matching chunk (no top-10 truncation) · VB vector five with the lexical
# leader rescued into slot 5 · VC = VA with both sides min-max normalised over the candidate set.
import asyncio, json, sys
sys.path.insert(0, "/app"); sys.path.insert(0, "/app/indexer")
from app import db, llm, retrieval
from app.config import settings
from acceptance_answers import CASES as FROZEN
from acceptance_generated import CASES as CORRECTED
from acceptance_routing import CASES as ROUTING
from acceptance_wo import CASES as WOBASE, PHRASINGS
MANUAL = json.load(open("/app/indexer/manual_cases.json", encoding="utf-8"))
S = settings()
VARS = ["V0", "r5", "VA", "VB", "VC"]


def key(h):
    return (str(h.meta.get("file")), str(h.meta.get("breadcrumb")), str(h.meta.get("chunk_index")))


def page(h):
    p = h.meta.get("page_number")
    try:
        return int(p)
    except Exception:
        return None


def fuse(vec, lex, alpha, minmax=False):
    keep, vp, lp = {}, {}, {}
    lex_max = max((float(h.meta.get("lexical_rank_score", 0.0)) for h in lex), default=0.0) or 1.0
    for h in vec:
        keep.setdefault(key(h), h)
        vp[key(h)] = max(0.0, 1.0 - h.distance / S.route_sim_floor)
    for h in lex:
        keep.setdefault(key(h), h)
        vp.setdefault(key(h), max(0.0, 1.0 - h.distance / S.route_sim_floor))
        lp[key(h)] = float(h.meta.get("lexical_rank_score", 0.0)) / lex_max
    if minmax:
        lo, hi = min(vp.values()), max(vp.values())
        vp = {k: ((v - lo) / (hi - lo) if hi > lo else 1.0) for k, v in vp.items()}
    sc = {k: alpha * vp.get(k, 0.0) + (1 - alpha) * lp.get(k, 0.0) for k in keep}
    return [keep[k] for k in sorted(sc, key=lambda k: (-sc[k], keep[k].distance))[:S.answer_chunks]]


def rescue(vec, lex):
    five = list(vec[:S.answer_chunks])
    if lex and all(key(lex[0]) != key(h) for h in five):
        five = (five[:S.answer_chunks - 1] + [lex[0]]) if len(five) >= S.answer_chunks else five + [lex[0]]
    return five


async def select(q, ui_module, terms):
    emb = await llm.embed(q, None)
    hits = await db.search_chunks(emb, S.route_top_k)
    routed = retrieval.route(hits, q, ui_module, terms)
    if routed.gate != "answer" or not routed.module:
        return routed, None
    m = routed.module
    vec = [h for h in hits if h.module == m and h.distance <= S.route_sim_floor]
    lex10 = [h for h in await db.search_lexical(emb, q, m, S.route_top_k) if h.distance <= S.route_sim_floor]
    lexall = [h for h in await db.search_lexical(emb, q, m, 100000) if h.distance <= S.route_sim_floor]
    return routed, {"V0": vec[:S.answer_chunks], "r5": fuse(vec, lex10, 0.5), "VA": fuse(vec, lexall, 0.5),
                    "VB": rescue(vec, lex10), "VC": fuse(vec, lexall, 0.5, minmax=True)}


def present(five, pred):
    for i, h in enumerate(five):
        if pred(h):
            return i + 1
    return 0


def short(h):
    return f"{str(h.meta.get('file'))[:30]} p{page(h)}"


async def main():
    terms = await retrieval.title_terms()
    totals = {}
    detail = []

    def tally(suite, row):
        detail.append(row)
        t = totals.setdefault(suite, {v: 0 for v in VARS} | {"n": 0})
        t["n"] += 1
        for v in VARS:
            t[v] += 1 if row[v] else 0

    async def run(suite, cid, q, ui_module, expect_module, pred, label):
        routed, sel = await select(q, ui_module, terms)
        row = {"suite": suite, "id": cid, "gate": routed.gate, "module": routed.module, "label": label}
        if sel is None:
            for v in VARS:
                row[v] = 0
        else:
            for v in VARS:
                r = present(sel[v], pred)
                if expect_module and str(routed.module).lower() != expect_module.lower():
                    r = 0
                row[v] = r
            row["kept"] = {v: sum(1 for h in sel[v] if any(key(h) == key(x) for x in sel["V0"])) for v in VARS}
            row["five"] = {v: [short(h) for h in sel[v]] for v in VARS}
        tally(suite, row)

    for cid, q, ctx, gate, mod, must, _ in ROUTING:
        routed, sel = await select(q, ctx, terms)
        row = {"suite": "routing", "id": cid, "gate": routed.gate, "module": routed.module, "label": q[:60]}
        for v in VARS:
            ok = (gate is None or routed.gate == gate) and (mod is None or str(routed.module or "").lower() == mod.lower())
            if ok and sel is not None and must:
                blob = " ".join(f"{h.meta.get('file')} {h.meta.get('section_title')} {h.meta.get('breadcrumb')}" for h in sel[v]).lower()
                ok = all(mm.lower() in blob for mm in must)
            row[v] = 1 if ok else 0
        if sel:
            row["kept"] = {v: sum(1 for h in sel[v] if any(key(h) == key(x) for x in sel["V0"])) for v in VARS}
            row["five"] = {v: [short(h) for h in sel[v]] for v in VARS}
        tally("routing", row)

    wo = [(c[0], c[1], c[7]) for c in WOBASE] + list(PHRASINGS)
    for cid, q, rule in wo:
        want = "Planned work orders" if rule == "planned-auto" else "How work orders are created"
        await run("work-order", cid, q, "technical", "technical",
                  lambda h, w=want: w.lower() in str(h.meta.get("file")).lower(), f"{rule}: needs '{want}'")
    for i, (cls, q, module, manual, pages, must, must_not, _src) in enumerate(FROZEN, 1):
        pg = (pages,) if isinstance(pages, int) else pages
        await run("frozen", f"{i:02d} {cls}", q, module, module,
                  lambda h, m=manual, p=pg: m.lower() in str(h.meta.get("file")).lower() and (p is None or page(h) in p), f"{manual} p{pg}")
    for i, (cls, q, module, manual, pages, must, must_not, _src) in enumerate(CORRECTED, 1):
        await run("corrected", f"gen-{i:02d}", q, module, module,
                  lambda h, m=manual: m.lower() in str(h.meta.get("file")).lower(), manual)
    for c in MANUAL:
        mod = c["file"].split(" - ")[0].lower()
        await run("manual", c["id"], c["question"], "technical", mod,
                  lambda h, f=c["file"], p=c["pages"]: str(h.meta.get("file")) == f and (not p or page(h) in p), f"{c['file'][:30]} p{c['pages']}")

    print("== expected source among the five excerpts (routing on; selection variant) ==")
    print(f"{'suite':<12}{'n':>4}" + "".join(f"{v:>8}" for v in VARS))
    for s, t in totals.items():
        print(f"{s:<12}{t['n']:>4}" + "".join(f"{t[v]:>8}" for v in VARS))
    print("\n== cases where a variant differs from V0 (value = rank of the expected chunk, or 1/0 for routing probes) ==")
    for r in detail:
        if any(bool(r[v]) != bool(r["V0"]) for v in VARS):
            print(f"  {r['suite']:<10} {r['id']:<22} gate={r['gate']} module={r['module']}  " + "  ".join(f"{v}={r[v]}" for v in VARS) + f"   [{r['label']}]")
            if r.get("five"):
                for v in VARS:
                    if v == "V0" or bool(r[v]) != bool(r["V0"]):
                        print(f"      {v}: " + " | ".join(r["five"][v]))
    print("\n== vector-five chunks kept per variant (sum over answerable cases) ==")
    for s in totals:
        rows = [r for r in detail if r["suite"] == s and r.get("kept")]
        base = sum(len(r["five"]["V0"]) for r in rows)
        print(f"  {s:<12}" + "  ".join(f"{v}={sum(r['kept'][v] for r in rows)}/{base}" for v in VARS))
    json.dump(detail, open("/out/selectdiag.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


asyncio.run(main())
