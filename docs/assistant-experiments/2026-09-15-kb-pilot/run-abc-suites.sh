#!/bin/bash
# Step 2 (owner brief 15-Sep): same model (gpt-5.6-luna), prompt v5, retrieval settings and questions across three source sets.
#   A = manuals-only (855: 20 official PDFs + repairs + xrefs)  B = kb-base (911: A + 5 corrected code-derived docx)  C = kb-pilot-c (916: B + 5 KB files with provenance note)
cd ~/central-assistant-py
LOG=abc-runs.txt
RUN="docker run --rm -u root --network technical-rag-net --env-file $HOME/central-assistant/assistant.env -v $HOME/central-assistant-py/indexer:/app/indexer -v $HOME/central-assistant-py:/out -w /app -e PYTHONIOENCODING=utf-8 sail-assistant-py:prompt-v5 python"
SETS="--set A-manuals=http://sail-assistant-py-abc-a:8000 --set B-corrected=http://sail-assistant-py-abc-b:8000 --set C-kbpilot=http://sail-assistant-py-abc-c:8000"
{
echo "===== ABC SUITES $(date -u +%FT%TZ): luna + v5 on A manuals-only 855 / B kb-base 911 / C kb-pilot-c 916 ====="
for p in 8021 8022 8023; do curl -s http://127.0.0.1:$p/health; echo; done
echo; echo "--- FROZEN 12, 3 runs ---"
$RUN indexer/acceptance_answers.py --repeat 3 $SETS --dump /out/abc-answers-dump.jsonl
echo; echo "--- WORK-ORDER 8 phrasings (judge .9), 3 runs ---"
$RUN indexer/acceptance_wo.py --repeat 3 --phrasings $SETS --dump /out/abc-wo-dump.jsonl
echo; echo "--- CORRECTED 14, 3 runs ---"
$RUN indexer/acceptance_generated.py --repeat 3 $SETS --dump /out/abc-generated-dump.jsonl
echo; echo "--- RETRIEVAL 18 ---"
$RUN indexer/compare_sets.py $SETS --expect-version 1
echo; echo "===== DONE $(date -u +%FT%TZ) ====="
} > $LOG 2>&1
