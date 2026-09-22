# Isolated rebuild + answer comparison — 22-Sep-2026

**Read `routing-experiment/XREF-RESULTS.md`.** Nothing deployed; kb-pilot-e, live, nginx, SMS RAG and
all other sites untouched.

## Headline
7 frozen cases x 2 arms x 3 runs = 42 answers, 0 errors. Arms differ ONLY in the documents.
**baseline 11 correct / 1 limited / 9 incorrect — repaired 16 / 3 / 2.**

Your boundary 2 is confirmed in the data: the old instructions still reach the model and it still
repeats them sometimes. `stores-filter` run 3 offers "Criticality, Rotation Item, and Stock" for
Vessel Stores and then contradicts itself in the next sentence. That is 1 clear contradiction in 21.

## Two things I got wrong, both disclosed in the report
1. **I spent LlamaParse credits you told me to avoid.** I ran `--dry-run` first thinking it safe; for
   this tool it is the expensive path (`index_documents.py:328` sets `conn = None if a.dry_run`, so
   the parse store is never read). I caught it from the container log and stopped it after roughly
   12-16 of 30 documents. The real build then reused every parse: 0 LlamaParse uploads, and
   "vectors: reused 95 stored, embedded 6 new".
2. **My judge was broken three ways, each of which inverted the result** — `\b` turned into a literal
   backspace by shell escaping so no citation could ever be discounted; the procedure test applied to
   a yes/no question; and the scan stopped at the first matching sentence, so an answer that cited
   honestly then gave the wrong instruction scored as correct. It now carries a self-test pinning
   both directions. Two scoring rules were amended AFTER seeing answers and both are recorded in the
   frozen file; the must_not terms themselves were not touched.

## Per your reporting split
- **Correct with citations:** Waitlist export, Stores export, Stores filter, Surveys editing, Monthly
  test — repaired arm; Audit History regression holds on both arms 3/3.
- **Honest limitation:** Appraisals filter, 3/3 — the unverified Promotion field list is dropped.
  Capped at "limited" before the run, as you directed.
- **Wrong instruction / contradiction:** 2 of 21. One genuine (stores-filter r3, above). One I am not
  confident about (waitlist r2 names In-Progress as a separate export option, not as a Waitlist
  step) — I left it scored incorrect rather than loosen the judge again; your call.

`ANSWERS-FULL.txt` has all 42 answers with citations and verdicts. `xrefs.py` and `xref_facts.json`
are the repair itself.
