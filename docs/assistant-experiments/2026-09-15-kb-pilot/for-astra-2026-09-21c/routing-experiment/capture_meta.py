# Second capture: the parts of the routing decision that need NO embedding — the module the question
# names, the title-term map it is matched against, and the tuning constants the analysis must reuse.
# Kept separate from capture.py so it can be re-run for free.
#
#   docker exec sail-assistant-py-f1 python /tmp/capture_meta.py /tmp/cases.json > meta.json
#
# No model calls at all.
import asyncio
import json
import sys

sys.path.insert(0, "/app")
from app import retrieval                                # noqa: E402
from app.config import settings                          # noqa: E402


async def main() -> None:
    with open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/cases.json", encoding="utf-8") as fh:
        cases = json.load(fh)
    s = settings()
    terms = await retrieval.title_terms()
    out = {}
    for c in cases:
        named, why = retrieval.explicit_module(c["question"], terms)
        out[c["id"]] = {"named": named, "why": why}
    json.dump({
        "settings": {
            "index_set": s.assistant_index_set,
            "route_sim_floor": s.route_sim_floor,
            "route_margin": s.route_margin,
            "route_top_k": s.route_top_k,
            "answer_chunks": s.answer_chunks,
            "route_intent": s.assistant_route_intent,
            "hybrid": s.assistant_hybrid,
            "second_opinion_gap": s.assistant_second_opinion_gap,
            "rescue_lex_per_term": s.assistant_rescue_lex_per_term,
            "rescue_max_penalty": s.assistant_rescue_max_penalty,
        },
        "title_terms": terms,
        "module_labels": retrieval.MODULE_LABELS,
        "module_aliases": retrieval.MODULE_ALIASES,
        "explicit_module": out,
    }, sys.stdout, ensure_ascii=False, indent=1)


asyncio.run(main())
