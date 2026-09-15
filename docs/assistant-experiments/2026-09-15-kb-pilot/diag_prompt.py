"""Prompt comparison on the EXACT captured five-excerpt contexts (owner GO, 15-Sep-2026). Runs INSIDE the prompt-v2 candidate
container (sail-assistant-py-exp2) so the model client, model settings (gpt-4o-mini, T=0.2) and masking path are the served
ones. Nothing is retrieved: the user message of each question is replayed VERBATIM from diag-capture.jsonl (arm NORMAL,
5 excerpts, no consolidation). Two system prompts: v2 (verbatim from the wire, sha b37172f6122a0257) and the v4 candidate
(from the branch's retrieval.docs_prompt, sha recorded) — or any prompt set in the input file. 2 questions x N prompts x 3 runs.
Usage: python diag_prompt.py [input.json] [output.json] ASSISTANT_CAPTURE_OUTBOUND (this
process only) records the actual wire bodies; capture line ranges are stored per run. Writes /app/out/prompt-results.json.
"""
import asyncio
import hashlib
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, "/app")
from app import agent  # noqa: E402
from app.config import settings  # noqa: E402
from app.masking import Masker  # noqa: E402

IN_PATH = sys.argv[1] if len(sys.argv) > 1 else "/app/out/prompt-compare-input.json"
IN = json.load(open(IN_PATH, encoding="utf-8"))
RUNS = 3
CAP = os.environ.get("ASSISTANT_CAPTURE_OUTBOUND", "")
OUT = sys.argv[2] if len(sys.argv) > 2 else "/app/out/prompt-results.json"


def cap_lines() -> int:
    try:
        with open(CAP, encoding="utf-8") as f:
            return sum(1 for _ in f)
    except FileNotFoundError:
        return 0


async def main() -> None:
    s = settings()
    health = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=10).read().decode("utf-8"))
    for k, p in IN["prompts"].items():
        assert hashlib.sha256(p["system"].encode()).hexdigest()[:16] == p["sha"], k
    record = {"ran_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "container_hostname": os.uname().nodename, "health": health,
              "settings": {"chat_model": s.chat_model, "masking_enabled": s.masking_enabled, "model_settings": dict(agent._model_settings())},
              "prompts": {k: {"label": p["label"], "sha": p["sha"], "chars": len(p["system"])} for k, p in IN["prompts"].items()},
              "contexts": {k: {"question": c["question"], "chars": c["chars"], "sha": hashlib.sha256(c["user"].encode()).hexdigest()[:16]} for k, c in IN["contexts"].items()},
              "capture_file": CAP or None, "runs": []}
    masker = Masker() if s.masking_enabled else None
    if masker:
        masker.register("Acceptance", "PERSON")
    for cid, c in IN["contexts"].items():
        for pk in IN["prompts"]:
            p = IN["prompts"][pk]
            for r in range(1, RUNS + 1):
                start = cap_lines()
                t0 = time.monotonic()
                answer, usage = await agent.answer_docs(p["system"], c["user"], masker)
                res = {"case": cid, "question": c["question"], "prompt": pk, "prompt_sha": p["sha"], "run": r, "answer": answer, "usage": usage,
                       "latency_ms": int((time.monotonic() - t0) * 1000), "capture_lines": [start, cap_lines()]}
                record["runs"].append(res)
                print(f"[{cid}] {pk} run {r}: capture lines {res['capture_lines']} · {len(answer)} chars · {answer[:90]!r}", flush=True)
                await asyncio.sleep(0.5)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=1)
    print("written", OUT)


asyncio.run(main())
