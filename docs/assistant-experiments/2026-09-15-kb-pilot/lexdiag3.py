# Embedding-only diagnostic (no answer model): for each question, the service's vector list (C0 = top-5 by distance inside the
# routed module) versus the hybrid fusion at alpha 0.5 (D2) and 0.7 (D3), with each chunk's distance and lexical score.
import asyncio, os, sys
sys.path.insert(0, "/app")
from app import db, llm, retrieval
from app.config import settings
QS = [
 ("F01", "audit", "In the audit preparation checklist observations view, how do I export the data and what do I do with vessel comments?"),
 ("F03", "safety", "How do I upload a document for the first time in the SMS module?"),
 ("F06", "incident", "What actions can I take on a near miss record from the list — what do the icons do?"),
 ("F10", "safety", "When filling MoC Part B, what happens if I select No for further assessment?"),
 ("G01", "technical", "In Bulk Data Import for jobs, do I have to fill in the Job Code column?"),
 ("G04", "technical", "In work-order numbers, what do the vessel code and the segment after it mean, and what does an unplanned work order number look like?"),
 ("G06", "technical", "Who can generate work orders from the office, and what happens if the vessel's switch is off?"),
 ("G14", "technical", "Which office screen holds the per-vessel switches such as office work-order generation and running-hours entry?"),
 ("R01", "technical", "how do I create a work order"),
 ("R03", "technical", "why did the running hours not go down after I completed the work order"),
]
def tag(h):
    m = h.meta
    pg = m.get("page") or m.get("page_label") or m.get("page_number") or "-"
    return f"{str(m.get('file'))[:42]} p{pg} · {str(m.get('breadcrumb') or m.get('section_title'))[-34:]}"
async def main():
    s = settings()
    print("meta keys sample:", end=" ")
    first = True
    for cid, module, q in QS:
        emb = await llm.embed(q, None)
        hits = await db.search_chunks(emb, s.route_top_k)
        if first:
            print(sorted(hits[0].meta.keys())); first = False
        vec = [h for h in hits if h.module == module and h.distance <= s.route_sim_floor]
        lex = [h for h in await db.search_lexical(emb, q, module, s.route_top_k) if h.distance <= s.route_sim_floor]
        lexmax = max([h.meta.get("lexical_rank_score", 0) for h in lex] or [1])
        print(f"\n== {cid} [{module}] {q}")
        print("  C0 five (vector order):")
        for h in vec[:5]: print(f"     d={h.distance:.4f}  {tag(h)}")
        print("  lexical list (score, distance):")
        for h in lex: print(f"     lex={h.meta.get('lexical_rank_score',0):.3f} d={h.distance:.4f}  {tag(h)}")
        for a in (0.5, 0.7):
            fused = retrieval.score_fuse(vec, lex, s.answer_chunks, a, s.route_sim_floor)
            print(f"  fused alpha={a}:")
            for h in fused:
                lx = h.meta.get("lexical_rank_score", 0)
                sc = a * (1 - h.distance / s.route_sim_floor) + (1 - a) * (lx / lexmax if lexmax else 0)
                mark = "" if any(v is h or (v.meta.get('file') == h.meta.get('file') and v.text == h.text) for v in vec[:5]) else "  <-- not in C0 five"
                print(f"     s={sc:.3f} d={h.distance:.4f} lex={lx:.3f}  {tag(h)}{mark}")
        lost = [v for v in vec[:5] if not any(f.text == v.text for f in retrieval.score_fuse(vec, lex, s.answer_chunks, 0.5, s.route_sim_floor))]
        for v in lost: print(f"  LOST at 0.5: {tag(v)} (d={v.distance:.4f}, in lexical list: {any(l.text == v.text for l in lex)})")
asyncio.run(main())
