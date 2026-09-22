# Cross-reference repair — isolated rebuild and answer comparison

22-Sep-2026. Two arms differing **only in the documents**: same image `v6-r9`, same model
`gpt-5.6-luna`, prompt v5, retrieval settings and cross-module flags.

| arm | container | index |
|---|---|---|
| baseline | `sail-assistant-py-g1` :8036 | `kb-pilot-e` — 921 chunks, unrepaired |
| repaired | `sail-assistant-py-g2` :8037 | `kb-xref-a` — 967 chunks, repaired resolver |

**Nothing deployed. `kb-pilot-e` untouched. Live, nginx, SMS RAG and all other sites untouched.**

## Two things I got wrong during the run, both disclosed

**1. I spent LlamaParse credits after being told to reuse cached parses.** I ran the rebuild with
`--dry-run` first, assuming it was the cautious option. For this tool it is the expensive one:
`index_documents.py:328` sets `conn = None if a.dry_run`, so the DB parse store is never consulted
and every document is re-parsed; its on-disk cache also defaults to a path under the read-only
documents mount, so nothing persisted either. I noticed the container idling at 0.16% CPU, read its
log, saw "uploading … to LlamaParse v2" and stopped it — roughly 12–16 of 30 documents had been
re-parsed. The correct path was then verified on one document before committing to the rest, and the
real build reports **0 LlamaParse uploads** and `vectors: reused 95 stored, embedded 6 new`.

**2. My judge was broken, in three separate ways, and each inverted the result.** Found by testing it
against sentences whose answer I already knew:
- both discount patterns had every `\b` turned into a literal backspace (`\x08`) by shell escaping,
  so they could never match and every honest citation was scored as a wrong instruction;
- the procedure test was applied to a yes/no permission question (the Audit History regression case);
- the scan stopped at the **first** sentence containing a forbidden term, so an answer that cited the
  source honestly and then gave the wrong instruction two lines later scored as correct.
`judge_xref.py` now carries a self-test pinning both directions — sentences that must be discounted
and sentences that must not.

Two scoring rules were amended **after** seeing answers, and both are recorded in the frozen file: a
forbidden term is discounted when it appears in an attribution or an explicit denial rather than an
instruction, and a yes/no question is exempt from the "two instruction steps" test. The `must_not`
terms themselves were not changed.

## Result — 7 frozen cases × 2 arms × 3 runs = 42 answers, 0 errors

```
case                       baseline r1  r2         r3          repaired r1  r2         r3
waitlist-export            incorrect    incorrect  incorrect   correct      incorrect  correct
monthly-test-create        correct      correct    correct     correct      correct    correct
appraisals-filter          incorrect    incorrect  incorrect   limited      limited    limited
stores-export              limited      correct    correct     correct      correct    correct
stores-filter              incorrect    incorrect  incorrect   correct      correct    incorrect
surveys-edit               correct      correct    correct     correct      correct    correct
audit-history-regression   correct      correct    correct     correct      correct    correct

baseline   correct 11/21   limited 1/21   incorrect 9/21
repaired   correct 16/21   limited 3/21   incorrect 2/21
```

### Correct procedure, with citations

- **Waitlist export** — baseline says *"Click the **In-Progress** sub-sub-module"* in all three runs.
  Repaired says *"Click the **Waitlist** sub-sub-module"* and cites In-Progress only as the source.
- **Stores filter** — baseline offers *"the **Criticality**, **Rotation Item**, or **Stock** dropdown
  filters"*. Repaired gives Search and Stock and states the other two **are not available on this
  screen**, which is the code-verified position.
- **Stores export**, **Surveys editing**, **Monthly test** — correct on the repaired arm 3/3.
- **Audit History regression holds**: correct on both arms 3/3, still answering from §3.3 p.16.

### Honest limitation

- **Appraisals filter** — repaired drops the unverified Promotion field list, 3/3. Capped at
  *limited* before the run, as instructed: omitting the fields is honest, not a repaired procedure.
  Baseline was *incorrect* 3/3, offering "Name, **Promotion Rank**, Vessel, …" as Appraisals filters.

### Wrong instruction or contradiction — 2 of 21 on the repaired arm

- **`stores-filter` run 3 — a genuine contradiction, and the clearest evidence for the reviewer's
  point.** The answer gives the Office Stores filters correctly, then for Vessel PMS says *"Use the
  search field and dropdown filters: **Criticality, Rotation Item, and Stock**"* and immediately adds
  *"However, the same excerpt's screen verification states that only Search…"*. It took the wrong
  filters from the quoted part and contradicted its own adapted guidance in the same answer. The
  quoted text still reaches the model, and here the model repeated it.
- **`waitlist-export` run 2 — flagged, and I am not confident it is a defect.** The three steps are
  correct and say Waitlist. The flag is a trailing sentence: *"Other supported export options are the
  **In-Progress** procedure and **Crew Database**."* That names In-Progress as a separate feature
  rather than as a step for Waitlist. I have left the mechanical verdict as **incorrect** rather than
  loosen the judge again to make it pass; the reviewer should decide.

## What this establishes, and what it does not

- The repair changes real answers: 9 wrong instructions on the baseline become 2 on the repaired arm.
- **It does not eliminate them.** The original quotation still contains the old instructions and the
  model repeated them in 1 clear case out of 21. Labelling and adaptation reduce the risk; they do
  not remove it.
- 7 questions, 3 runs, one index pair. Non-determinism is visible in the results — the same case
  differs across runs on both arms.
- The Crewing field lists remain unverified, so Appraisals cannot rise above *limited* without
  evidence from the Crewing frontend, which is in no repository available here.
