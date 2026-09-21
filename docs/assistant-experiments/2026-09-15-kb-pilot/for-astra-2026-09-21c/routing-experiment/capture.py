# Bounded retrieval capture — what the retriever had available BEFORE routing chose a module.
#
# Runs INSIDE the candidate container (sail-assistant-py-f1, index kb-pilot-e), so the API key never
# leaves the server and the app's own settings, embedding model and SQL are reused verbatim:
#
#   docker cp capture.py sail-assistant-py-f1:/tmp/ ; docker cp cases.json sail-assistant-py-f1:/tmp/
#   docker exec sail-assistant-py-f1 python /tmp/capture.py /tmp/cases.json > candidates.json
#
# Per case, using the ORIGINAL question text unchanged:
#   vector_topk   the unscoped nearest chunks (the exact list route() sees; route_top_k of them are used)
#   module_best   the nearest chunk of EVERY module, over the whole corpus — this is the measurement the
#                 reviewer asked for. The earlier report INFERRED "no Audit chunk reached the distance
#                 limit" from the served citations, which only ever contain the chosen module. This
#                 measures it instead, per module, per question.
#   lexical_topk  the unscoped lexical ranking, built from the question itself with the SAME OR-of-terms
#                 query, the same heading bonus and the same table-of-contents exclusion as the shipped
#                 db.search_lexical — the only change is that no module filter is applied.
#   expected_doc  the nearest chunk of the case's expected document, when the case names one.
#
# No chat/answer model is called. One embedding call per case. Nothing is written to any database and no
# container state changes.
import asyncio
import json
import re
import sys

sys.path.insert(0, "/app")
from app import db, llm                                  # noqa: E402
from app.config import settings                          # noqa: E402
from sqlalchemy import text                              # noqa: E402

VEC_K = 50
LEX_K = 50

ROWS = ("module, file, section_title, breadcrumb, page_number, chunk_index, "
        "power(embedding <-> CAST(:q AS vector), 2) AS distance")


def row(r) -> dict:
    m = dict(r._mapping)
    return {"module": (m.get("module") or "").lower(), "file": m.get("file"),
            "section": m.get("section_title"), "breadcrumb": m.get("breadcrumb"),
            "page": m.get("page_number"), "chunk_index": m.get("chunk_index"),
            "distance": round(float(m["distance"]), 6),
            **({"lex": round(float(m["lex"] or 0.0), 6)} if "lex" in m else {})}


async def one(conn, case: dict) -> dict:
    s = settings()
    emb = await llm.embed(case["question"], None)          # the one model call, same model as production
    q = "[" + ",".join(f"{x:.8f}" for x in emb) + "]"
    p = {"q": q, "s": s.assistant_index_set}

    vec = (await conn.execute(text(
        f"SELECT {ROWS} FROM assistant_chunks WHERE index_set=:s "
        "ORDER BY embedding <-> CAST(:q AS vector) LIMIT :k"), {**p, "k": VEC_K})).fetchall()

    best = (await conn.execute(text(
        "SELECT DISTINCT ON (lower(module)) lower(module) AS module, file, section_title, page_number, "
        "power(embedding <-> CAST(:q AS vector), 2) AS distance "
        "FROM assistant_chunks WHERE index_set=:s "
        "ORDER BY lower(module), embedding <-> CAST(:q AS vector)"), p)).fetchall()

    # lexical, unscoped — identical to db.search_lexical minus the module filter
    words = [w for w in re.findall(r"[a-z0-9][a-z0-9'&-]{1,}", case["question"].lower())
             if w not in db._STOPWORDS]
    lex = []
    if words:
        orq = " | ".join(dict.fromkeys(words))
        lex = (await conn.execute(text(
            f"SELECT {ROWS}, ts_rank_cd(tsv, to_tsquery('english', :orq)) "
            "+ ts_rank_cd(to_tsvector('english', coalesce(section_title, '') || ' ' "
            "|| coalesce(breadcrumb, '')), to_tsquery('english', :orq)) AS lex "
            "FROM assistant_chunks WHERE index_set=:s AND tsv @@ to_tsquery('english', :orq) "
            "AND lower(coalesce(breadcrumb, '')) NOT LIKE '%table of contents%' "
            "AND lower(coalesce(section_title, '')) NOT LIKE '%table of contents%' "
            "ORDER BY lex DESC LIMIT :k"), {**p, "orq": orq, "k": LEX_K})).fetchall()

    exp = []
    if case.get("expected_file"):
        exp = (await conn.execute(text(
            f"SELECT {ROWS} FROM assistant_chunks WHERE index_set=:s AND file=:f "
            "ORDER BY embedding <-> CAST(:q AS vector) LIMIT 3"),
            {**p, "f": case["expected_file"]})).fetchall()

    return {**case, "n_content_words": len(words),
            "vector_topk": [row(r) for r in vec],
            "module_best": {(r._mapping["module"]): {"distance": round(float(r._mapping["distance"]), 6),
                                                     "file": r._mapping["file"],
                                                     "section": r._mapping["section_title"],
                                                     "page": r._mapping["page_number"]} for r in best},
            "lexical_topk": [row(r) for r in lex],
            "expected_doc_nearest": [row(r) for r in exp]}


async def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/cases.json"
    with open(path, encoding="utf-8") as fh:
        cases = json.load(fh)
    out = []
    async with db.engine().connect() as conn:
        for i, case in enumerate(cases, 1):
            out.append(await one(conn, case))
            print(f"  {i:>3}/{len(cases)}  {case['id']}", file=sys.stderr)
    json.dump({"index_set": settings().assistant_index_set,
               "embed_model": settings().embed_model,
               "route_sim_floor": settings().route_sim_floor,
               "route_margin": settings().route_margin,
               "route_top_k": settings().route_top_k,
               "answer_chunks": settings().answer_chunks,
               "vec_k": VEC_K, "lex_k": LEX_K, "cases": out}, sys.stdout, ensure_ascii=False)


asyncio.run(main())
