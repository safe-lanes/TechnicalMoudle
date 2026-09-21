# Reviewer pack — bounded retrieval experiment, CORRECTED (21-Sep-2026, second pack)

Replaces `for-astra-2026-09-21.zip`. All four points from the rerun are addressed; the first two
changed the headline numbers and both corrections go against my previous report.

- **Expected module was wrong on two cases.** The harness copied the originating screen into the
  expected answer module. Corrected with an explicit table quoting the suite's own wording:
  current behaviour is **100 correct / 0 clarify / 1 wrong**, not 98/3. The Technical "search miss"
  is withdrawn, and so is the claim that the explicit-name rule produced a wrong module.
- **"67/67 passages" was a filename check.** At page level it is **62 of 65**, and none of last
  round's proposals improved on it. `sms-office-1` — the reviewer's own example — fails at page
  level under every rule while passing at file level.
- **Blast radius restated as questions, not slots:** R5a changes the excerpts of 22 of 101 questions.
  Checking them found real harm: R5a and R5c fix `hist-1` but push the actual answer page out of
  `inc-1`. A non-displacing variant (R6c) fixes `hist-1` and loses nothing.
- **Citation label confirmed in the shipped source.** `citations_of` stamps the routed module on every
  hit. Already latent for the existing `second_opinion`. A one-line per-hit fix is part of the candidate.

Read `routing-experiment/ROUTING-EXPERIMENT.md`. `ANALYSIS-OUTPUT.txt` is the raw table as printed.

Single candidate proposed for the small answer test: **R6c + per-hit citation label**. Not implemented,
not run, nothing deployed. No new model calls were made for these corrections — the captured data was
rescored.
