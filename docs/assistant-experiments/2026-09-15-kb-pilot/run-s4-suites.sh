#!/bin/bash
# Step 4/6 measurement: C0 (flags off) vs D1 (intent routing) vs D2 (intent + hybrid score fusion) on kb-pilot-c, image prompt-v5-r5,
# luna + v5. Retrieval 18 + work-order 8x3 on all three (attribution); frozen 12x3, corrected 14x3, manual-coverage 57x3 on D2 (final package).
cd ~/central-assistant-py
RUN="docker run --rm -u root --network technical-rag-net --env-file $HOME/central-assistant/assistant.env -v $HOME/central-assistant-py/indexer:/app/indexer -v $HOME/central-assistant-py:/out -w /app -e PYTHONIOENCODING=utf-8 sail-assistant-py:prompt-v5-r5 python"
ALL="--set C0-off=http://sail-assistant-py-s4-c0:8000 --set D1-intent=http://sail-assistant-py-s4-d1:8000 --set D2-hybrid=http://sail-assistant-py-s4-d2:8000"
D2="--set D2-hybrid=http://sail-assistant-py-s4-d2:8000"
{
echo "===== STEP 4/6 SUITES $(date -u +%FT%TZ): image prompt-v5-r5, index kb-pilot-c 916, luna + v5 ====="
for p in 8024 8025 8026; do curl -s http://127.0.0.1:$p/health; echo; done
echo; echo "--- RETRIEVAL 18 (C0/D1/D2) ---"; $RUN indexer/compare_sets.py $ALL --expect-version 1
echo; echo "--- WORK-ORDER 8 phrasings x3 (C0/D1/D2, judge .11) ---"; $RUN indexer/acceptance_wo.py --repeat 3 --phrasings $ALL --dump /out/s4-wo-dump.jsonl
echo; echo "--- FROZEN 12 x3 (D2) ---"; $RUN indexer/acceptance_answers.py --repeat 3 $D2 --dump /out/s4-answers-dump.jsonl
echo; echo "--- CORRECTED 14 x3 (D2) ---"; $RUN indexer/acceptance_generated.py --repeat 3 $D2 --dump /out/s4-generated-dump.jsonl
echo; echo "--- MANUAL-COVERAGE 57 x3 (D2) ---"; $RUN indexer/acceptance_manuals.py --repeat 3 $D2 --dump /out/s4-manuals-dump.jsonl
echo; echo "===== DONE $(date -u +%FT%TZ) ====="
} > s4-runs.txt 2>&1
