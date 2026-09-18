# Diagnose the demonstrated retrieval/routing defects with EMBEDDINGS ONLY (no answer-model calls).
# For each affected question: the module decision and why, the vector top-10, where the EXPECTED chunk sits in the
# vector ranking, and where it sits in the lexical ranking of its own module — so a fix can be chosen on evidence.
import asyncio
import json
import os
import re
import sys

sys.path.insert(0, "/app")
os.environ.setdefault("ASSISTANT_INDEX_SET", "kb-pilot-c")
from app import db, llm, retrieval  # noqa: E402
from app.config import settings  # noqa: E402

CASES_SPEC = [("hist-1", "audit"), ("master-review-2", "safety"), ("prep-3", "audit"),
              ("sms-office-1", "safety"), ("pmsoffice-5", "technical")]
_ALL = {c["id"]: c for c in json.load(open("/app/indexer/manual_cases.json", encoding="utf-8"))}
CASES = [(cid, mod, _ALL[cid]["file"], _ALL[cid]["pages"], _ALL[cid]["question"]) for cid, mod in CASES_SPEC]



def page_of(h):
    p = h.meta.get("page_number")
    try:
        return int(p)
    except Exception:
        m = re.search(r"\(p\.(\d+)\)", str(h.meta.get("breadcrumb") or ""))
        return int(m.group(1)) if m else None


def is_expected(h, f, pages):
    return str(h.meta.get("file", "")).startswith(f.rsplit(".", 1)[0][:40]) and (not pages or page_of(h) in pages)


async def main():
    s = settings()
    terms = await retrieval.title_terms()
    for cid, expmod, f, pages, q in CASES:
        print("\n" + "=" * 110)
        print(f"{cid}: {q}")
        emb = await llm.embed(q, None)
        hits = await db.search_chunks(emb, 40)
        routed = retrieval.route(hits[: s.route_top_k], q, "technical", terms)
        named, why = retrieval.explicit_module(q, terms)
        print(f"  routed -> {routed.gate} / {routed.module}  reason={getattr(routed, 'reason', '-')}  (explicit={named}: {why})")
        best = {}
        for h in hits:
            best.setdefault(h.module, h.distance)
        print("  per-module best distance (top-40):", {k: round(v, 4) for k, v in sorted(best.items(), key=lambda kv: kv[1])})
        print("  vector top-10:")
        for i, h in enumerate(hits[:10], 1):
            print(f"    {i:>2} d={h.distance:.4f} [{h.module}] {str(h.meta.get('file'))[:44]} p{page_of(h)} · {str(h.meta.get('section_title'))[:44]}"
                  + ("   <== EXPECTED" if is_expected(h, f, pages) else ""))
        rank = next((i for i, h in enumerate(hits, 1) if is_expected(h, f, pages)), None)
        if rank:
            print(f"  EXPECTED chunk vector rank {rank} of 40, distance {hits[rank - 1].distance:.4f}")
        else:
            print("  EXPECTED chunk NOT in the vector top-40")
        for mod in {expmod, routed.module or expmod}:
            lex = await db.search_lexical(emb, q, mod, 10)
            print(f"  lexical top-5 in [{mod}]:")
            for i, h in enumerate(lex[:5], 1):
                print(f"    {i} lex={h.meta.get('lexical_rank_score', 0):.3f} d={h.distance:.4f} {str(h.meta.get('file'))[:42]} p{page_of(h)} · {str(h.meta.get('section_title'))[:40]}"
                      + ("   <== EXPECTED" if is_expected(h, f, pages) else ""))
            lrank = next((i for i, h in enumerate(lex, 1) if is_expected(h, f, pages)), None)
            print(f"    expected chunk lexical rank in {mod}: {lrank}")
        # what the five excerpts are today (routing on, rescue on), and what would be displaced
        if routed.gate == "answer" and routed.module:
            vec = [h for h in hits if h.module == routed.module and h.distance <= s.route_sim_floor]
            lex = [h for h in await db.search_lexical(emb, q, routed.module, s.route_top_k) if h.distance <= s.route_sim_floor]
            five = retrieval.lexical_rescue(vec, lex, s.answer_chunks)
            print("  five excerpts under r6 (rescue):")
            for i, h in enumerate(five, 1):
                print(f"    {i} d={h.distance:.4f} {str(h.meta.get('file'))[:42]} p{page_of(h)} · {str(h.meta.get('section_title'))[:40]}"
                      + ("   <== EXPECTED" if is_expected(h, f, pages) else ""))
            if lex and vec:
                dropped = vec[s.answer_chunks - 1] if len(vec) >= s.answer_chunks else None
                if dropped is not None and all(str(dropped.text) != str(x.text) for x in five):
                    print(f"    rescue displaced: d={dropped.distance:.4f} {str(dropped.meta.get('file'))[:42]} p{page_of(dropped)} "
                          f"· {str(dropped.meta.get('section_title'))[:40]}   (rescued chunk d={lex[0].distance:.4f}, lex={lex[0].meta.get('lexical_rank_score', 0):.3f})")


asyncio.run(main())
