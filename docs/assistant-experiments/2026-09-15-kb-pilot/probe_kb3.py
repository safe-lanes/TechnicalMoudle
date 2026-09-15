"""Rank probe (top 8) for the 8 work-order questions + 5 general Technical questions in kb-base and kb-pilot, and the
EXACT excerpt text the docs path would supply (top answer_chunks=5 hits of the winning module, text[:3000]) saved per
question/set for the failing-run attachments."""
import asyncio, json, os, sys
sys.path.insert(0, "/app")
from openai import OpenAI
from app import db, retrieval
from app.config import settings
WO = ["How do I create a work order?", "How are planned work orders created in PMS — do I have to create them myself?", "How to create work order in PMS?",
      "What are the different ways to create a work order in PMS?", "I need to raise a work order for a pump — how do I do that?",
      "Do I create work orders myself or does the system create them?", "Steps to create a new work order", "How do work orders get created in the Technical module?"]
GEN = ["How do I record a stock transaction for spares?", "How do I add a new store item?", "How do I raise a defect on equipment?",
       "How do I update running hours for a component?", "How do I add a component to a vessel?"]
async def main():
    oai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    out = {}
    for q in WO + GEN:
        emb = oai.embeddings.create(model="text-embedding-3-large", input=[q]).data[0].embedding
        for s in ("kb-base", "kb-pilot"):
            os.environ["ASSISTANT_INDEX_SET"] = s; settings.cache_clear()
            hits = await db.search_chunks(emb, settings().route_top_k)
            routed = retrieval.route(hits)
            top8 = hits[:8]
            print(f"\n== {q!r} · {s} · gate={routed.gate} module={routed.module} margin={routed.confidence:.3f}")
            for i, h in enumerate(top8, 1):
                m = h.meta; tag = "OVERVIEW" if "How work orders are created" in str(m.get("file")) else ("PILOT   " if m.get("source") == "kb-pilot" else "        ")
                print(f"  {i:2d} {h.distance:.4f} {tag} {str(m.get('file'))[:44]:<44} {str(m.get('breadcrumb')).split('>')[-1].strip()[:40]}")
            out[f"{q} || {s}"] = [{"rank": i + 1, "file": h.meta.get("file"), "section": retrieval.section_of(h.meta), "distance": round(h.distance, 4), "text": h.text[:3000]} for i, h in enumerate(routed.hits)]
    json.dump(out, open("/app/out/kb3-excerpts.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
asyncio.run(main())
