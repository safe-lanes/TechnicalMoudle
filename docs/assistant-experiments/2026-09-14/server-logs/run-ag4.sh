#!/bin/bash
# Controlled experiment: the live set's own cached agentic parses, four builds.
cd ~/central-assistant-py
run() { name=$1; shift; echo "##### $name #####"; docker run --rm -u root --name sail-index-$name --network technical-rag-net --env-file ~/central-assistant/assistant.env --env-file ~/central-assistant/indexer.env -v ~/central-assistant-py/documents:/app/documents:ro -v ~/central-assistant-py/indexer:/app/indexer:ro -v ~/central-assistant-py/llamaparse_cache_ag:/app/llamaparse_cache sail-assistant-py:port python indexer/index_documents.py --documents /app/documents --tier agentic --version latest --force --index-set $name "$@" 2>&1 | grep -E "^(> |##|index set|DONE|   FAILED|   accepted|   on-disk|   uploading)" ; }
# run ag-base (done)
run ag-clean --clean
# run ag-xref (done)
run ag-both  --clean --resolve-xrefs
echo "ALL FOUR DONE"
