#!/bin/bash
# r6 (lexical rescue) on D4 :8028 versus D1 (routing only) — same model (gpt-5.6-luna, default temperature), prompt v5, index kb-pilot-c.
# D4: routing probes, retrieval 18, WO 8x3, frozen 12x3, corrected 14x3, manual-coverage 57x3 (capture mounted → support check).
# D1: the two suites it still lacked (corrected 14x3, manual-coverage 57x3) so the routing-only package is fully measured too.
cd ~/central-assistant-py
RUN="docker run --rm -u root --network technical-rag-net --env-file $HOME/central-assistant/assistant.env -v $HOME/central-assistant-py/indexer:/app/indexer -v $HOME/central-assistant-py:/out -w /app -e PYTHONIOENCODING=utf-8 sail-assistant-py:prompt-v5-r6 python"
D1="--set D1-intent=http://sail-assistant-py-s4-d1:8000"
D4="--set D4-rescue=http://sail-assistant-py-s4-d4:8000"
{
echo "===== STEP 4c $(date -u +%FT%TZ): r6 lexical rescue (D4, image prompt-v5-r6) vs D1; luna + v5; kb-pilot-c ====="
curl -s http://127.0.0.1:8028/health; echo
echo; echo "--- ROUTING probes D1/D4 ---"; $RUN indexer/acceptance_routing.py $D1 $D4 --dump /out/s4c-routing-dump.jsonl
echo; echo "--- RETRIEVAL 18 D4 ---"; $RUN indexer/compare_sets.py $D4 --expect-version 1
echo; echo "--- WORK-ORDER 8 x3 (D4, judge .11) ---"; $RUN indexer/acceptance_wo.py --repeat 3 --phrasings $D4 --dump /out/s4c-wo-dump.jsonl
echo; echo "--- FROZEN 12 x3 (D4) ---"; $RUN indexer/acceptance_answers.py --repeat 3 $D4 --dump /out/s4c-answers-dump.jsonl
echo; echo "--- CORRECTED 14 x3 (D1, D4) ---"; $RUN indexer/acceptance_generated.py --repeat 3 $D1 $D4 --dump /out/s4c-generated-dump.jsonl
echo; echo "--- MANUAL-COVERAGE 57 x3 (D1, D4; D4 capture mounted) ---"; $RUN indexer/acceptance_manuals.py --repeat 3 $D1 $D4 --dump /out/s4c-manuals-dump.jsonl --capture D4-rescue=/out/s4-captures/d4/capture.jsonl
echo; echo "===== DONE $(date -u +%FT%TZ) ====="
} > s4c-runs.txt 2>&1
