#!/bin/bash
# Corrective rebuild (owner-authorised 22-Sep-2026): index set kb-xref-d from documents-final (20 PDFs + 4 R3 docx + Recent
# Updates R6) and kb-r6 (5 KB files). Same indexer image (sail-assistant-idx:r9f), resolver 2026-09-22.3, repairs, quote-excluded
# layout and chunker as the frozen candidate kb-xref-c.
#   step A: ONLY the R6 Recent Updates docx, WITHOUT --cache-only  -> exactly one LlamaParse job (the authorised exception)
#   step B: everything, --cache-only                                -> any other cache miss ABORTS the build (no paid call)
# Live, nginx and every running container untouched: this script only runs throwaway indexer containers.
set -u
cd "$HOME/central-assistant-py"
RUN="docker run --rm -u root --network technical-rag-net --env-file $HOME/central-assistant/assistant.env --env-file $HOME/central-assistant/indexer.env -e PYTHONIOENCODING=utf-8 -e XREF_LAYOUT=quote-excluded -v $HOME/central-assistant-py/documents-final:/app/documents:ro -v $HOME/central-assistant-py/kb-r6/technical/work-orders:/kb:ro -v $HOME/central-assistant-py/llamaparse_cache:/cache -w /app sail-assistant-idx:r9f python indexer/index_documents.py --index-set kb-xref-d --resolve-xrefs --apply-repairs --cache-dir /cache"
{
echo "===== STEP A: Recent Updates R6 only (one LlamaParse job authorised) $(date -u +%FT%TZ) ====="
$RUN --only "Technical - Recent Updates & Changed Behaviours (Operational) Notes.docx"
A=$?
echo "===== STEP A exit $A $(date -u +%FT%TZ) ====="
if [ "$A" -ne 0 ]; then echo "STEP A FAILED — stopping before step B"; exit 1; fi
echo "===== STEP B: full build, cache-only, KB files $(date -u +%FT%TZ) ====="
$RUN --cache-only --kb-dir /kb --kb-provenance-line
echo "===== STEP B exit $? $(date -u +%FT%TZ) ====="
} > s10/build-kb-xref-d.log 2>&1
