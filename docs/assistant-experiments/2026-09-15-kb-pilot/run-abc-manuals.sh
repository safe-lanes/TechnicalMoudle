#!/bin/bash
# Step 3: manual-coverage suite (57 source-backed cases over all 20 official manuals) on the three source sets, 3 runs; captures on each container.
cd ~/central-assistant-py
RUN="docker run --rm -u root --network technical-rag-net --env-file $HOME/central-assistant/assistant.env -v $HOME/central-assistant-py/indexer:/app/indexer -v $HOME/central-assistant-py:/out -w /app -e PYTHONIOENCODING=utf-8 sail-assistant-py:prompt-v5 python"
SETS="--set A-manuals=http://sail-assistant-py-abc-a:8000 --set B-corrected=http://sail-assistant-py-abc-b:8000 --set C-kbpilot=http://sail-assistant-py-abc-c:8000"
{
echo "===== MANUAL-COVERAGE SUITE $(date -u +%FT%TZ): luna + v5 on A/B/C, 57 cases x 3 runs ====="
$RUN indexer/acceptance_manuals.py --repeat 3 $SETS --dump /out/abc-manuals-dump.jsonl
echo "===== DONE $(date -u +%FT%TZ) ====="
} > abc-manuals-runs.txt 2>&1
