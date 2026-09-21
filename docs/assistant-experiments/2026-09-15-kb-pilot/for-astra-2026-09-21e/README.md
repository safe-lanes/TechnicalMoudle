# Reviewer pack — assessment finished on the 204 collected answers (fifth pack)

No new model calls. **Read `routing-experiment/ASSESSMENT.md`.**

Baseline caveat, up front: this compares against the **experimental F1 arm**, not the deployed
configuration.

## Your three corrections
1. **Token usage was there and I missed it** — the field is `prompt_tokens`/`completion_tokens`, not
   `total_tokens`. Your figures reproduce exactly: input 153,396 → 173,025, output 26,202 → 26,313.
   **273 extra input tokens per affected answer**, not my estimated 225. Attribution checked: the 10
   questions whose excerpts do not change show a **+0** input delta, so all of it comes from the 24.
   Dollar cost not stated — I do not have the rates.
2. **Correct labels ≠ correct answers** — accepted. Counted separately: **93 added citations across
   three runs (31 per set)**, of which the answer names the added manual in only **6 instances**
   (`hist-1` ×3, `fresh-ctx-conflict-1` ×3). So on **22 of 24** affected questions the added evidence
   is inert — paid for and unused. That is the honest cost picture.
3. **Text similarity withdrawn as evidence** — replaced by a case-by-case reading of all 144 answers
   on the 24 affected questions, each against the excerpts actually supplied to it.

## Result of that reading
- **Supported: 24 of 24.** No answer asserts anything its excerpts do not carry; no added cross-module
  excerpt contaminated an answer, including the cases where it was most likely (Audit + Crewing filter
  procedures added to a Technical filter question; Audit checklist attachments added to a survey
  attachment question).
- **Regressions: 0.**
- **Two answers improved beyond the target case** — `pmsoffice-5` now declines the unsupported
  Dashboard-vs-vessel comparison the baseline made between two different screens; `ra-office-3` carries
  both clauses of a verbatim sentence in 3/3 runs where the baseline managed 2/3.
- The other 10 questions get byte-identical excerpts, so the candidate is the same system on the same
  input; not read, and stated as a limit rather than a result.

## Your Waitlist question — answered, and it is our defect, not the model's
The manual means *"use the same procedure within Waitlist"*. Our **cross-reference resolver** pasted
In-Progress's steps into the Waitlist section verbatim without rewriting the sub-module name, so the
indexed chunk literally says "Click on the 'In-Progress' sub-sub module". Both arms reproduced the
supplied text faithfully. **41 chunks carry a resolved cross-reference; 7 name a different sub-module
than the section they sit in** (Crewing p.21/22/23, Technical Store p.43/44/49/51). Not fixed — it
belongs to document generation and needs a re-index.

**Deployment on hold. Live and all other sites unchanged.**
