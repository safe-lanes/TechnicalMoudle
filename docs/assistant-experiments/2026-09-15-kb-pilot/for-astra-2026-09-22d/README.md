# Third comparison — quote kept OUT of the text, outgoing context captured. 22-Sep-2026.
Nothing deployed; live, nginx, SMS RAG and all other services untouched.

Read `routing-experiment/XREF-RESULTS-v3.md`.

- **"18 vs 17" withdrawn.** With field-level rules (Surveys editable fields; All Categories) applied to
  the existing answers, arm A is 12/6/3 — your reading was right, its total was a judge artefact.
- **Quote-excluded layout built** (`kb-xref-c`: 0 source step lines in any resolved chunk text, 41 quotes
  in metadata) **and the actual outgoing context captured** for all 21 of its requests
  (`capture-g4.jsonl`, `CONTEXT-CHECK-g4.txt`): the adapted block was present in 21/21, but a source
  step line still reached the model in **9/21 — every time because the SOURCE SECTION ITSELF was
  retrieved as a separate excerpt** (1.2.1.5, 1.6.1.2, 1.1.3.4). Removing the quote from the resolved
  chunk does not keep the old instructions out of the context; retrieval brings them back.
- Captured run: baseline 6/0/15 · audit-copy 16/3/2 · quote-excluded 16/3/2 — equal. An earlier
  uncaptured sample (my error, file not writable by the container) had quote-excluded worse: 14/3/4.
- Proposal, NOT built: retrieval-time suppression of the pointed-to source section when its resolved
  destination chunk is supplied. That is a serving-code change with its own test.
- `--cache-only` now aborts the whole build on a miss. A rebuild that silently skipped all 25 documents
  on an unchanged build key was caught and redone after bumping XREF_VERSION.
- Provenance regex tightened to the hand classification; code evidence regenerated with the Surveys
  columns and the three Stores views.
