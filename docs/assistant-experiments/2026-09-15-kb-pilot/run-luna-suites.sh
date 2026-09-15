#!/bin/bash
# Runs on the bridge network (DB host name resolves there; services addressed by container name), as root so dumps can be written.
# Suites for the gpt-5.6-luna + prompt v5 candidate (8020) vs baseline v2 + gpt-4o-mini (8018), both on index set kb-pilot.
cd ~/central-assistant-py
LOG=luna-runs.txt
RUN="docker run --rm -u root --network technical-rag-net --env-file $HOME/central-assistant/assistant.env -v $HOME/central-assistant-py/indexer:/app/indexer -v $HOME/central-assistant-py:/out -w /app -e PYTHONIOENCODING=utf-8 sail-assistant-py:prompt-v5 python"
SETS="--set A-v2-4omini=http://sail-assistant-py-exp2:8000 --set B-v5-luna=http://sail-assistant-py-luna:8000"
{
echo "===== LUNA SUITES $(date -u +%FT%TZ): A = 8018 prompt-v2 gpt-4o-mini T=0.2 · B = 8020 prompt-v5 gpt-5.6-luna T=default · index kb-pilot 916 both ====="
curl -s http://127.0.0.1:8020/health; echo; curl -s http://127.0.0.1:8018/health; echo
echo; echo "--- FROZEN 12 (case 09 first), 3 runs ---"
$RUN indexer/acceptance_answers.py --repeat 3 $SETS --dump /out/luna-answers-dump.jsonl
echo; echo "--- WORK-ORDER 8 phrasings (judge .8), 3 runs ---"
$RUN indexer/acceptance_wo.py --repeat 3 --phrasings $SETS --dump /out/luna-wo-dump.jsonl
echo; echo "--- CORRECTED 14, 3 runs ---"
$RUN indexer/acceptance_generated.py --repeat 3 $SETS --dump /out/luna-generated-dump.jsonl
echo; echo "--- RETRIEVAL 18 ---"
$RUN indexer/compare_sets.py $SETS --expect-version 1
echo; echo "===== DONE $(date -u +%FT%TZ) ====="
} > $LOG 2>&1
