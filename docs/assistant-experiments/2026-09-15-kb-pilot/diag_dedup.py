"""Controlled comparison: NORMAL excerpts vs Office/Vessel duplicate pairs CONSOLIDATED (owner GO, 15-Sep-2026).
Runs INSIDE the prompt-v2 candidate container (sail-assistant-py-exp2, index set kb-pilot). Same prompt, model settings,
index and relative excerpt order. Two questions x two arms x 3 runs; ASSISTANT_CAPTURE_OUTBOUND (set for this process only)
records the actual wire bodies; capture line ranges are stored per run.

  arm NORMAL — app.chat.handle_chat(...) (the served docs path minus HTTP).
  arm DEDUP  — the same docs path (embed -> retrieve -> route), then eligible Office/Vessel pairs among the routed hits are
               consolidated AT THE FIRST OCCURRENCE (second member removed, freed slot NOT refilled), then docs_prompt ->
               agent.answer_docs. Eligibility is decided from the texts, not the headings:
                 * one hit from the Office manual and one from the Vessel manual with the same section key
                   (section title without page number);
                 * every Vessel step/sentence line (figure refs, screenshot descriptions, page footers ignored) has an
                   equivalent line in the Office text (difflib ratio >= 0.97) -> Office is the superset;
                 * the merged excerpt = Office text + an explicit 'Vessel manual differs' note listing every Office-only line
                   and every non-identical line, with both source references in the header.
               Pairs that fail the check stay separate. Every decision and difference is recorded in the results file.
Writes /app/out/dedup-results.json.
"""
import asyncio
import difflib
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, "/app")
from app import agent, chat, db, llm, retrieval  # noqa: E402
from app.config import settings  # noqa: E402
from app.masking import Masker  # noqa: E402

QUESTIONS = [("wo-generic-01", "How do I create a work order?"), ("wo-phr-01", "What are the different ways to create a work order in PMS?")]
RUNS = 3
CAP = os.environ.get("ASSISTANT_CAPTURE_OUTBOUND", "")
OUT = "/app/out/dedup-results.json"
OFFICE = "PMS User Manual For Office"
VESSEL = "PMS User Manual_Vessel Specific"
_n = 0


def identity() -> dict:
    global _n
    _n += 1
    return {"userId": f"dedup-{_n}", "userName": "Acceptance", "role": "Sail Admin", "tenantDomain": "smoke-suite-tenant"}


def cap_lines() -> int:
    try:
        with open(CAP, encoding="utf-8") as f:
            return sum(1 for _ in f)
    except FileNotFoundError:
        return 0


def section_key(meta: dict) -> str:
    return re.sub(r"\s*\(p\.\d+\)\s*$", "", retrieval.section_of(meta)).strip().lower()


def content_lines(text: str) -> list[str]:
    """Step/sentence lines only: drop figure captions, screenshot descriptions, page footers; normalise figure refs."""
    out = []
    for ln in text.splitlines():
        s = ln.strip()
        if not s or re.match(r"^(figure \d+|page \d+ of \d+|screenshot[: ]|screenshot of )", s, flags=re.I):
            continue
        s = re.sub(r"\s*\(ref figure \d+\)", "", s, flags=re.I)
        s = re.sub(r"^[*☞\\]+\s*", "", s).strip()
        out.append(s)
    return out


def match(line: str, pool: list[str]) -> tuple[str | None, float]:
    best, score = None, 0.0
    for p in pool:
        r = difflib.SequenceMatcher(None, line.lower(), p.lower()).ratio()
        if r > score:
            best, score = p, r
    return best, score


def consolidate(hits: list[db.Hit]) -> tuple[list[db.Hit], list[dict]]:
    decisions: list[dict] = []
    used: set[int] = set()
    out: list[db.Hit] = []
    for i, h in enumerate(hits):
        if i in used:
            continue
        partner = None
        for j in range(i + 1, len(hits)):
            if j in used:
                continue
            g = hits[j]
            a, b = str(h.meta.get("file") or ""), str(g.meta.get("file") or "")
            one_each = (OFFICE in a and VESSEL in b) or (VESSEL in a and OFFICE in b)  # exactly one Office and one Vessel manual hit
            if section_key(h.meta) == section_key(g.meta) and one_each:
                partner = j
                break
        if partner is None:
            out.append(h)
            continue
        g = hits[partner]
        off, ves = (h, g) if OFFICE in str(h.meta.get("file")) else (g, h)
        off_lines, ves_lines = content_lines(off.text), content_lines(ves.text)
        ves_unmatched = []
        non_identical = []
        for ln in ves_lines:
            m, r = match(ln, off_lines)
            if r < 0.97:
                ves_unmatched.append(ln)
            elif m != ln:
                non_identical.append({"vessel": ln, "office": m})
        off_only = [ln for ln in off_lines if match(ln, ves_lines)[1] < 0.97]
        d = {"position_first": i + 1, "position_second": partner + 1, "office": retrieval.manual_of(off.meta) + " — " + retrieval.section_of(off.meta),
             "vessel": retrieval.manual_of(ves.meta) + " — " + retrieval.section_of(ves.meta), "office_only_lines": off_only,
             "vessel_only_lines": ves_unmatched, "non_identical_lines": non_identical, "office_chars": len(off.text), "vessel_chars": len(ves.text)}
        if ves_unmatched:
            d["decision"] = "kept separate — the Vessel text has a line the Office text does not"
            decisions.append(d)
            out.append(h)
            continue
        note = [f"Vessel manual ({retrieval.manual_of(ves.meta)} — {retrieval.section_of(ves.meta)}): the same steps as above, with these differences:"]
        for ln in off_only:
            note.append(f"- Office manual only (not in the Vessel manual): \"{ln}\"")
        for ni in non_identical:
            note.append(f"- Vessel manual wording: \"{ni['vessel']}\" (Office: \"{ni['office']}\")")
        if not off_only and not non_identical:
            note.append("- none: the two texts are identical apart from figure numbers.")
        merged_text = off.text.rstrip() + "\n\n" + "\n".join(note) + "\n"
        meta = dict(off.meta)
        meta["breadcrumb"] = f"{off.meta.get('breadcrumb')} [consolidated with {retrieval.manual_of(ves.meta)} — {retrieval.section_of(ves.meta)}]"
        meta["consolidated_from"] = [retrieval.manual_of(off.meta) + " — " + retrieval.section_of(off.meta), retrieval.manual_of(ves.meta) + " — " + retrieval.section_of(ves.meta)]
        merged = db.Hit(meta=meta, text=merged_text, distance=min(h.distance, g.distance), module=h.module)
        d["decision"] = "consolidated at the first occurrence"
        d["merged_chars"] = len(merged_text)
        d["merged_note"] = "\n".join(note)
        decisions.append(d)
        used.add(partner)
        out.append(merged)
    return out, decisions


async def arm_normal(q: str) -> dict:
    ident = identity()
    t0 = time.monotonic()
    code, resp = await chat.handle_chat({"message": q, "context": {"module": "technical"}}, ident, "")
    return {"identity": ident, "http_status": code, "response": resp, "latency_ms": int((time.monotonic() - t0) * 1000)}


async def arm_dedup(q: str) -> dict:
    s = settings()
    ident = identity()
    tenant = ident["tenantDomain"]
    masking_on = s.masking_enabled and tenant not in s.masking_disabled_tenants
    masker = Masker() if masking_on else None
    if masker:
        masker.register(ident["userName"], "PERSON")
    routed = retrieval.route(await retrieval.retrieve(await llm.embed(q, masker)))
    assert routed.gate == "answer", routed.gate
    before = [{"manual": retrieval.manual_of(h.meta), "section": retrieval.section_of(h.meta), "chars": len(h.text), "distance": round(h.distance, 4)} for h in routed.hits]
    hits2, decisions = consolidate(routed.hits)
    routed2 = retrieval.Routed("answer", hits=hits2, module=routed.module, confidence=routed.confidence)
    system, user = retrieval.docs_prompt(q, routed2)
    t0 = time.monotonic()
    answer, usage = await agent.answer_docs(system, user, masker)
    return {"identity": ident, "masking_on": masking_on, "excerpts_before": before, "decisions": decisions,
            "excerpts_after": [{"manual": retrieval.manual_of(h.meta), "section": retrieval.section_of(h.meta), "chars": len(h.text)} for h in hits2],
            "system": system, "user": user, "answer": answer, "usage": usage, "citations": retrieval.citations_of(routed2),
            "latency_ms": int((time.monotonic() - t0) * 1000)}


async def main() -> None:
    s = settings()
    health = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=10).read().decode("utf-8"))
    async with db.engine().connect() as c:
        from sqlalchemy import text
        n = int((await c.execute(text("SELECT count(*) FROM assistant_chunks WHERE index_set=:s"), {"s": s.assistant_index_set})).scalar_one())
    record = {"ran_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "container_hostname": os.uname().nodename, "health": health,
              "settings": {"chat_model": s.chat_model, "answer_chunks": s.answer_chunks, "route_top_k": s.route_top_k, "route_sim_floor": s.route_sim_floor,
                           "route_margin": s.route_margin, "masking_enabled": s.masking_enabled, "model_settings": dict(agent._model_settings())},
              "index": {"index_set": s.assistant_index_set, "chunks": n}, "capture_file": CAP or None, "runs": []}
    for cid, q in QUESTIONS:
        for arm in ("normal", "dedup"):
            for r in range(1, RUNS + 1):
                start = cap_lines()
                res = await arm_normal(q) if arm == "normal" else await arm_dedup(q)
                res.update({"case": cid, "question": q, "arm": arm, "run": r, "capture_lines": [start, cap_lines()]})
                record["runs"].append(res)
                ans = res["response"]["response"] if arm == "normal" else res["answer"]
                extra = f" · excerpts {len(res['excerpts_before'])}→{len(res['excerpts_after'])}" if arm == "dedup" else ""
                print(f"[{cid}] {arm} run {r}: capture lines {res['capture_lines']}{extra} · {len(ans)} chars · {ans[:90]!r}", flush=True)
                await asyncio.sleep(0.5)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=1)
    print("written", OUT)


asyncio.run(main())
