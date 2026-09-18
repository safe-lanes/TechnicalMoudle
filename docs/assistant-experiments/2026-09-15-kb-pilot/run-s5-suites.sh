#!/bin/bash
# Owner brief 18-Sep, item 6 — final package verification against a clearly identified baseline, ONE image for all three.
#   B0  image v6-r7, flags OFF, prompt v5  = the controlled baseline (the C0 measurement that was missing)
#   D5a image v6-r7, routing ON + guarded rescue (r7), prompt v5  = routing + selection only
#   D5  image v6-r7, routing ON + guarded rescue (r7), prompt v6  = the final candidate
# Same model (gpt-5.6-luna, default temperature), same key, same index (kb-pilot-c 916). Captures mounted per container.
cd ~/central-assistant-py
RUN="docker run --rm -u root --network technical-rag-net --env-file $HOME/central-assistant/assistant.env -v $HOME/central-assistant-py/indexer:/app/indexer -v $HOME/central-assistant-py:/out -w /app -e PYTHONIOENCODING=utf-8 sail-assistant-py:v6-r7 python"
ALL="--set B0=http://sail-assistant-py-b0:8000 --set D5a=http://sail-assistant-py-d5a:8000 --set D5=http://sail-assistant-py-d5:8000"
{
echo "===== STEP 6 FINAL VERIFICATION $(date -u +%FT%TZ): image v6-r7, index kb-pilot-c 916, gpt-5.6-luna default temperature ====="
for p in 8029 8030 8031; do curl -s http://127.0.0.1:$p/health; echo; done
echo; echo "--- ROUTING probes (B0/D5a/D5) ---";      $RUN indexer/acceptance_routing.py $ALL --dump /out/s5-routing-dump.jsonl
echo; echo "--- RETRIEVAL 18 (B0/D5a/D5) ---";        $RUN indexer/compare_sets.py $ALL --expect-version 1
echo; echo "--- WORK-ORDER 8 x3 ---";                 $RUN indexer/acceptance_wo.py --repeat 3 --phrasings $ALL --dump /out/s5-wo-dump.jsonl
echo; echo "--- FROZEN 12 x3 ---";                    $RUN indexer/acceptance_answers.py --repeat 3 $ALL --dump /out/s5-answers-dump.jsonl
echo; echo "--- CORRECTED 14 x3 ---";                 $RUN indexer/acceptance_generated.py --repeat 3 $ALL --dump /out/s5-generated-dump.jsonl
echo; echo "--- FRESH VALIDATION 10 x3 ---";          $RUN indexer/acceptance_fresh.py --repeat 3 $ALL --dump /out/s5-fresh-dump.jsonl
echo; echo "--- MANUAL-COVERAGE 57 x3 ---";           $RUN indexer/acceptance_manuals.py --repeat 3 $ALL --dump /out/s5-manuals-dump.jsonl \
   --capture B0=/out/s5-captures/b0/capture.jsonl --capture D5a=/out/s5-captures/d5a/capture.jsonl --capture D5=/out/s5-captures/d5/capture.jsonl
echo; echo "===== DONE $(date -u +%FT%TZ) ====="
} > s5-runs.txt 2>&1
