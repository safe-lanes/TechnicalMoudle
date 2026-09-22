# Fourth comparison — generation bug fixed, input captured and traced. 22-Sep-2026.
Nothing deployed; live, nginx, SMS RAG and all other services untouched.

Read `routing-experiment/XREF-RESULTS-v4.md`.

- **Your finding reproduced and fixed.** Rule 2 saw a parenthesised filter list but only rewrote
  "such as"/"by" lists, so "(Criticality, Rotation Item, or Stock)" survived INSIDE my adapted Stores
  block and contradicted it. Scan of all 41 adapted blocks: exactly one carried it; after the rebuild, 0.
  My "cannot be fixed in the documents" is retracted.
- **Three false failures corrected**, published scores preserved beside the corrected ones
  (captured run: audit-copy 16/3/2 -> 18/3/0; quote-excluded 16/3/2 -> 17/3/1).
- **Rebuilt cache-only** (951 = 947 reused + 4 new, 0 uploads, 0 skips) **and re-run with the actual
  input captured**: mechanical baseline 6/0/15 · audit-copy 17/3/1 · quote-excluded 18/3/0. The one
  mechanical failure is the provenance sentence ("the manual notes that ..."), not a wrong screen — left
  scored incorrect rather than widen the rules again. On reading, zero wrong-screen/wrong-field
  instructions remain on either repaired arm.
- **Per-excerpt tracing of the captured input** (`TRACE-rerun-g4.txt`, tool validated on the previous
  build's capture where it reproduces your finding): 0 source terms in our adapted blocks; 15 in
  denials; 12 in the manual's own pointer sentences; 15 in separately retrieved source sections
  (1.2.1.5, 1.6.1.2, 1.1.3.4, every run) — and none of those requests produced a wrong instruction.
  **Suppression stays unbuilt**: no remaining failure traces to retrieved source text.
