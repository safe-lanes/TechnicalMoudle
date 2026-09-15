import asyncio, os, sys
sys.path.insert(0, "/app")
os.environ["ASSISTANT_INDEX_SET"] = "kb-pilot-c"
from app import db, llm, retrieval
from app.config import settings
async def main():
    for q in ["How to create work order in PMS?", "I need to raise a work order for a pump — how do I do that?"]:
        emb = await llm.embed(q, None)
        vec = [h for h in await db.search_chunks(emb, 10) if h.module == "technical"]
        lex = await db.search_lexical(emb, q, "technical", 10)
        print(f"\n== {q}")
        print("  vector top:", [(str(h.meta.get('file'))[:38], round(h.distance, 3)) for h in vec][:8])
        print("  lexical top:", [(str(h.meta.get('file'))[:38], round(h.meta.get('lexical_rank_score', 0), 3), round(h.distance, 3)) for h in lex])
        fused = retrieval.score_fuse([h for h in vec if h.distance <= settings().route_sim_floor], [h for h in lex if h.distance <= settings().route_sim_floor], 5, settings().assistant_hybrid_alpha, settings().route_sim_floor)
        print("  fused top-5:", [str(h.meta.get('file'))[:38] + " · " + str(h.meta.get('breadcrumb'))[-30:] for h in fused])
asyncio.run(main())
