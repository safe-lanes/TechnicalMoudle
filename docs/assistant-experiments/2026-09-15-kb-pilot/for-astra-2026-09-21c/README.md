# Reviewer pack — candidate answer test, 21-Sep-2026 (third pack)

All four points from the rerun are corrected, and the bounded candidate answer test has been RUN.

## Corrections first
- **The change count was a counting bug.** `analyse.py` counted only removed excerpts, so a rule that
  only adds material reported "0 questions changed". Corrected: **R6c adds 31 excerpts across 24
  questions and removes none** — the reviewer's figures confirmed exactly, mine (26) was wrong.
- **"Breaks nothing" withdrawn as a claim.** Established only that no existing excerpt is removed.
- **"One remaining defect" corrected** to *one incorrect module selection in this experiment*. The
  work-order switch contradiction, the missing passages (`prep-3`, `sms-office-1`) and the unresolved
  citation-review claims all remain open.
- Expected-page coverage 62/65 → **63/65** confirmed: Audit History gains its page, Incident keeps its
  evidence.

## The answer test — 34 questions × 2 arms × 3 runs = 204 responses, 0 errors
Baseline `f1` vs candidate `g1` (new container, port 8036), same model, prompt v5 and index.

1. **Audit History fixed 3 runs of 3** — the candidate answers from Audit History §3.3 p.16 and cites
   it; the baseline answers from the work-order review procedure in all three.
2. **Module selection unchanged** — 33/34 both arms, every run.
3. **Citations 579 of 579 correctly labelled** on the candidate, including every cross-module one.
   The baseline scored 486/486, which confirms the label defect is latent rather than observable:
   without the fix R6c would have mislabelled 31 citations.
4. **No Technical procedure presented as Safety functionality.** `fresh-ctx-conflict-1` says "not
   covered in the Safety documentation" in all three runs and attributes the Technical material to
   Technical.
5. **Text diffing is noise** — baseline-vs-baseline similarity is 0.544. On the 10 test questions R6c
   does not touch, candidate-vs-baseline is 0.518 against a 0.522 noise floor: indistinguishable.
6. **Cost** — excerpts/answer 4.76 → 5.68; 21,616 added characters ≈ 5.4k tokens over 24 questions
   (~225 tokens per affected question, estimated at 4 chars/token: the API returned no usage field);
   latency median 3355 → 3210 ms, no increase.

Also found: the shipped dedup identity `(file, breadcrumb, chunk_index)` is not unique — 921 chunks,
919 distinct tuples. Low impact, not fixed, reported for the record.

`ANALYSIS-answers.txt` and `ANALYSIS-retrieval.txt` are the raw outputs; `answers.json` has all 204
responses with citations and latencies; `candidate-source/CANDIDATE.patch` is the whole code change.

**Nothing deployed.** The candidate exists only as container `sail-assistant-py-g1` on 127.0.0.1:8036;
the source change is flag-gated (`ASSISTANT_CROSS_MODULE_GAP` defaults to 0 = today's behaviour). f1,
f0 and all 33 other containers verified untouched by start time. Live service and all other sites
untouched.
