# Cross-reference repair — third comparison: quote kept out of the text, outgoing context captured

22-Sep-2026. **Nothing deployed. Live, nginx, SMS RAG and every other running service untouched.**
Candidate containers isolated on 127.0.0.1: g1 `kb-pilot-e` (baseline), g3 `kb-xref-b` (audit-copy
layout), g4 `kb-xref-c` (quote-excluded, outgoing context captured).

## 1. Corrections to my previous report, all against my own claims

| reviewer finding | verified | consequence |
|---|---|---|
| Arm A still gives wrong Surveys instructions ("Issue Date"), and omits All Categories | yes | field-level rules added to the frozen file and applied to the **existing** answers: **arm A is 12 / 6 / 3, not 18 / 3 / 0**. Its higher total was a judge artefact. "18 vs 17" is withdrawn. |
| Arm B was not a controlled layout comparison | yes | facts, rules and layout changed together; no layout conclusion was established from that run |
| The quote still reaches the model under the audit-copy layout | yes | it is appended to the same text; that tested a stronger warning only |
| Provenance regex over-flags | yes | tightened to explicit "the manual notes/states/says that … not verified"; the three flags now equal the hand classification (Monthly r1 and r3 on arm A; Waitlist r2 on arm B). The Waitlist "confirms the sequence, but … not separately verified" is not a misattribution. |
| Code-evidence pack unchanged | yes | regenerated at revision `f5e4c0d54`: Surveys editable columns (`SurveysPage.tsx:404–500`, five date fields, count 5), Certificates editable columns (count 8, no overlap), the three Stores views with their controls, and the counts. |
| `--cache-only` continued past a miss | yes | a `CacheMiss` now aborts the whole build (`SystemExit`), not just the document |

## 2. The further change the reviewer asked for, and what the captured context shows

`XREF_LAYOUT=quote-excluded`: the verbatim source text is **not written into the page** — it is stored
in the owning chunk's metadata (`source_quote`, 41 of 41 resolved sections) for audit and citation.
Verified against the index: **0 source step lines in any resolved chunk's text**, 41 quotes in
metadata. Built as `kb-xref-c` (951 chunks = 869 reused + 82 new, 0 LlamaParse uploads, 0 aborts,
0 skips after bumping `XREF_VERSION` to `2026-09-22.2` — a first rebuild had silently skipped all 25
documents on an unchanged build key, and I caught that only because the stale intro count stayed 41).

**Outgoing context, captured for all 21 g4 requests** (`capture-g4.jsonl`, `verify_capture.py`):

- 21 of 21 contained the adapted **Steps for …** block;
- **9 of 21 still contained a source step line** — and in every one of those nine the reason is the same:
  the **source section itself was retrieved as a separate excerpt**. Waitlist export ×3 → *1.2.1.5 How
  To Export Crew Details* (In-Progress) supplied; Appraisals filter ×3 → *1.6.1.2 How To Apply Filters*
  (Crew Promotion) supplied; Surveys edit ×3 → *1.1.3.4 How To Edit A Certificate* supplied.

So removing the quote from the resolved chunk does **not** keep the old instructions out of the
context. They arrive by retrieval of the pointed-to section, which is semantically the nearest text
to the question. That is the mechanism, established from the actual wire bodies, not inferred.

## 3. Results — the captured run (7 cases × 3 arms × 3 runs = 63, field-level rules)

```
                        baseline        repaired_b (audit copy)   repaired_c (quote excluded)
waitlist-export         inc inc inc     cor cor cor               cor cor cor
monthly-test-create     cor cor cor     cor cor cor               cor cor cor
appraisals-filter       inc inc inc     lim lim lim               lim lim lim
stores-export           inc inc inc     cor cor cor               cor cor cor
stores-filter           inc inc inc     inc cor inc               cor cor inc
surveys-edit            inc inc inc     cor cor cor               cor inc cor
audit-history           cor cor cor     cor cor cor               cor cor cor

baseline     6 / 0 / 15        repaired_b  16 / 3 / 2        repaired_c  16 / 3 / 2
```

An earlier run of the same three arms, made before the capture file was writable (my error: I had
truncated it as the host user, so the container's appends failed silently), scored baseline 6/1/14,
repaired_b 17/3/1, repaired_c **14/3/4**. It is kept as `xref-answers-c-uncaptured.json` and reported
as a second sample: across both samples repaired_c is **not better** than repaired_b, and on the
Stores-filter and Waitlist cases it was worse once.

The remaining failures on both repaired arms are the same two shapes: Stores-filter answers that list
Criticality/Rotation Item for the Vessel manual (the Spares filter section retrieved directly), and
one Surveys/Waitlist answer per run that repeats the source screen from the directly retrieved source
section. **These are answer defects, not judge errors**; each was read.

## 4. Where this leaves the repair

- **Established:** the adapted steps are correct and are used; the wrong-screen and wrong-field
  instructions the baseline gives 15 times in 21 fall to 2 in 21 on both repaired layouts; Audit History
  holds on every arm; Appraisals is honestly limited.
- **Established, and it changes the plan:** the residual failures come from the **source section being
  retrieved on its own**, not from the resolved chunk. Neither labelling the quote nor removing it from
  the chunk addresses that. The only place it can be addressed is retrieval — e.g. when a resolved
  destination chunk is supplied for a question, suppress or demote the exact section it points to.
  **Not built.** It is a change to the serving code, not to the documents, and it needs its own
  bounded test; I am proposing it, not doing it.
- **Not established:** any layout preference between b and c (equal on the captured run); the effect
  of retrieval-time suppression (unbuilt); the Crewing field lists (frontend unavailable).
- **Cost:** repaired arms ~+40–80 prompt tokens per answer over baseline; latency unchanged.

## 5. Housekeeping still owed

- The unplanned LlamaParse charge (~12–16 agentic jobs, ~05:00–05:25 UTC) remains unreconciled from
  logs — history API 410, journal unreadable; the LlamaCloud usage page is the only record.
- Rule 2b wording *"Click the 'required editable' cell"* is still cosmetic in the built index.
