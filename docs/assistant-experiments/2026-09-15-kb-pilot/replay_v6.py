# Replay prompt v5 versus v6 on IDENTICAL captured inputs (owner brief 18-Sep, item 4: any prompt change is versioned and
# compared against v5 on the same inputs before broader testing). The user message — the five excerpts and the question —
# is taken verbatim from the stored capture, so retrieval is held fixed and only the system prompt differs.
#   defect set  = the six runs the review found defective
#   control set = ten runs that were correct, including two honest-limitation runs that v6 must NOT turn into guesses
import asyncio
import hashlib
import json
import os
import sys

sys.path.insert(0, "/app")
os.environ.setdefault("ASSISTANT_INDEX_SET", "kb-pilot-c")
from app import agent, db, retrieval  # noqa: E402
from app.config import settings  # noqa: E402

DEFECTS = [("hist-3", 1), ("certsurveys-3", 2), ("pmsvessel-3", 2), ("safety-meeting-1", 1), ("safety-meeting-1", 2), ("pmsoffice-5", 3)]
CONTROLS = [("master-review-2", 1), ("sms-office-1", 1), ("moc-vessel-1", 1), ("ra-office-2", 1), ("pmsoffice-1", 1),
            ("fs-off-1", 1), ("inc-2", 1), ("crewing-5", 3), ("defects-2", 1), ("prep-1", 1)]
CASES = {c["id"]: c for c in json.load(open("/app/indexer/manual_cases.json", encoding="utf-8"))}


def v6_suffix() -> str:
    """The exact text v6 appends to v5 — derived from the code, not retyped."""
    dummy = retrieval.Routed("answer", hits=[db.Hit(meta={"file": "F.pdf", "breadcrumb": "F > S"}, text="T", distance=0.5, module="technical")], module="technical")
    os.environ["ASSISTANT_DOCS_PROMPT"] = "v5"
    settings.cache_clear()
    v5, _ = retrieval.docs_prompt("Q", dummy)
    os.environ["ASSISTANT_DOCS_PROMPT"] = "v6"
    settings.cache_clear()
    v6, _ = retrieval.docs_prompt("Q", dummy)
    os.environ["ASSISTANT_DOCS_PROMPT"] = "v5"
    settings.cache_clear()
    assert v6.startswith(v5), "v6 must be v5 plus a suffix"
    return v6[len(v5):]


def captured():
    """(question, run index) -> (system, user) exactly as sent during the D4 manual-coverage run."""
    out = {}
    counts = {}
    for line in open("/out/s4-d4-capture.jsonl", encoding="utf-8"):
        rec = json.loads(line)
        if "chat/completions" not in rec.get("url", ""):
            continue
        body = json.loads(rec["body"])
        msgs = body.get("messages", [])
        system = next((m["content"] for m in msgs if m.get("role") == "system"), "")
        user = next((m["content"] for m in msgs if m.get("role") == "user"), "")
        q = user.rsplit("\n\nQuestion: ", 1)[-1].strip()
        counts[q] = counts.get(q, 0) + 1
        out[(q, counts[q])] = (system, user)
    return out


async def main():
    suffix = v6_suffix()
    cap = captured()
    print(f"v6 suffix: {len(suffix)} chars, sha {hashlib.sha256(suffix.encode()).hexdigest()[:16]}")
    results = []
    for label, group in (("DEFECT", DEFECTS), ("CONTROL", CONTROLS)):
        for cid, run in group:
            q = CASES[cid]["question"]
            if (q, run) not in cap:
                print(f"  !! no capture for {cid} run {run}")
                continue
            system, user = cap[(q, run)]
            for pv, sys_text in (("v5", system), ("v6", system + suffix)):
                text, usage = await agent.answer_docs(sys_text, user, None)
                usage = usage or {}
                results.append({"group": label, "case": cid, "run": run, "prompt": pv, "answer": text, "usage": usage})
                print(f"\n===== {label} {cid} run{run} [{pv}] ({usage.get('prompt_tokens')} in / {usage.get('completion_tokens')} out)")
                print(text[:1200])
    json.dump(results, open("/out/replay-v6.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    tin = sum(r["usage"].get("prompt_tokens", 0) for r in results)
    tout = sum(r["usage"].get("completion_tokens", 0) for r in results)
    print(f"\nTOTAL {len(results)} calls · {tin} in / {tout} out tokens · ≈ ${tin * 0.2e-6 + tout * 1.2e-6:.4f}")


asyncio.run(main())
