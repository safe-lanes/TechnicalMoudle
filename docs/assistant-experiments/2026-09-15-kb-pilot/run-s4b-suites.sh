#!/bin/bash
# Attribution follow-up: D1 (routing only) frozen x3; D3 = D2 with vector-heavier fusion (alpha 0.7) — routing probes, frozen x3, WO x3.
cd ~/central-assistant-py
RUN="docker run --rm -u root --network technical-rag-net --env-file $HOME/central-assistant/assistant.env -v $HOME/central-assistant-py/indexer:/app/indexer -v $HOME/central-assistant-py:/out -w /app -e PYTHONIOENCODING=utf-8 sail-assistant-py:prompt-v5-r5 python"
{
echo "===== STEP 4b $(date -u +%FT%TZ): D1 frozen; D3 (alpha 0.7) probes + frozen + WO ====="
curl -s http://127.0.0.1:8027/health; echo
echo; echo "--- ROUTING probes C0/D2/D3 ---"; $RUN indexer/acceptance_routing.py --set C0-off=http://sail-assistant-py-s4-c0:8000 --set D2-a05=http://sail-assistant-py-s4-d2:8000 --set D3-a07=http://sail-assistant-py-s4-d3:8000 --dump /out/s4b-routing-dump.jsonl
echo; echo "--- RETRIEVAL 18 D3 ---"; $RUN indexer/compare_sets.py --set D3-a07=http://sail-assistant-py-s4-d3:8000 --expect-version 1
echo; echo "--- FROZEN 12 x3 (D1, D3) ---"; $RUN indexer/acceptance_answers.py --repeat 3 --set D1-intent=http://sail-assistant-py-s4-d1:8000 --set D3-a07=http://sail-assistant-py-s4-d3:8000 --dump /out/s4b-answers-dump.jsonl
echo; echo "--- WORK-ORDER 8 x3 (D3) ---"; $RUN indexer/acceptance_wo.py --repeat 3 --phrasings --set D3-a07=http://sail-assistant-py-s4-d3:8000 --dump /out/s4b-wo-dump.jsonl
echo; echo "===== DONE $(date -u +%FT%TZ) ====="
} > s4b-runs.txt 2>&1
