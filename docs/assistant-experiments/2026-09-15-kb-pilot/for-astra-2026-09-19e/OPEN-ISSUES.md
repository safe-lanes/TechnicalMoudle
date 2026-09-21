# Open issues register — SAIL AI assistant candidate (updated 19-Sep-2026, after the fourth review pass)

Kept because the reviewer asked that the work-order contradiction not become the only visible problem. Nothing
here is deployed or fixed unless it says so. Live is unchanged.

## A. Answer defects (the chatbot itself)

| # | issue | evidence | status |
|---|---|---|---|
| A1 | **Switch/role conflation.** An answer requires the office switch for per-job 'Generate WO' and then says the switch applies "only to planned-generation actions, not to per-job Generate WO". Only the *role* is exclusive. | `wo-phr-05` F1 r3; same conflation on `s4 · wo-generic-03 · D2-hybrid r3`. Detected by work-order judge `.13`. | **Open.** One targeted fix proposed, not applied → `PROPOSED-FIX-switch-scope.md`. A corpus sentence of mine (R5 §1.1.14.6.2) asserts the same error and is part of the proposal. |
| A6 | ~~Marker or related form turned into a rule~~ — **RETRACTED 19-Sep.** Both `certsurveys-2` and `fn-2` are **supported**: the manual says "Mandatory fields (*) must be completed before the record can be saved", and the Lesson Learnt manual p.7 WAS supplied. My search covered excerpt bodies only, not headers, and matched one phrasing rather than the meaning. | `review-ledger-s7.md` | **Closed — false finding.** |
| A2b | **Wrong feature, not audience-label inference.** (Reworded 19-Sep.) The `hist-1` answers describe the PMS **work-order** review procedure for a question about **inspection-history** review. The Office attribution is locally supported — the supplied text says "the user interface shown ... are applicable to the Office side" — so the earlier "inferred from an audience label" framing overstated it. | `review-ledger-s7.md`, verdict `unsupported` | **Open.** |
| A2 | **Audit History routing → a permission claim from the wrong feature.** "Who may comment in the Review section of an inspection history record" is routed to Technical; the Audit History manual is never supplied; the answer is built from the PMS *work-order* review section and turns a document audience label into a permission rule. Correct by coincidence. | `hist-1` r1–r3, the only unsupported claims in 1,245 → `citation-review-verdicts-s7.md` §C | **Open — root cause now PROVEN offline:** `_GENERIC_TITLE_WORDS` contains `history` and `preparation`, so `_terms_from_title()` returns `[]` for both Audit manuals and neither can be reached by name; with no named module the vector margin (0.1266) clears the 0.07 clarify threshold and Technical wins. One correction proposed with code locations and an offline-first verification plan → `ROUTING-PROPOSAL-audit-history.md`. **Not implemented.** |
| A3 | Corrected-claims **case 01** fails all three runs on **both** arms, on the answer check, with the expected document supplied and supporting. | `score8-s7.txt` | Open, pre-existing, unchanged by any of this work. |
| A4 | `prep-3` and `sms-office-1` chunks are indexed but not retrieved. | S39 part 1 review | Open. **`prep-*` is now explained by the same root cause as A2** — the Audit Preparation manual also yields no title term. |
| A5 | **R5 §1.1.14.6.2 states "Both refusals belong to 'Generate Now' only"** — wrong; only the role refusal is exclusive. A document error I introduced. | `DOC-ERROR-both-refusals.md` | **Open.** Text diff prepared, not applied; needs a re-index. **Not claimed to fix A1** — the failing answer never saw this sentence. |

## B. Retrieval / ranking

| # | issue | status |
|---|---|---|
| B1 | Corrected-claims **case 06 first-source ranking** sits behind the KB pilot file (36/42 runs). The answer is correct and the citation is accepted anywhere in the list. | Open by decision — the instruction was not to shorten the document to improve ranking. |
| B2 | The R5 restructure gives the generation section five chunks instead of one, which is why the KB file outranks it. | Consequence of B1, reported not tuned. |

## C. Test-suite quality (not chatbot defects)

| # | issue | status |
|---|---|---|
| C1 | Work-order cases name their expected manual as the bare string **"Technical"**, which resolves to 14 corpus documents. | Open. Not the cause of the earlier review flags (that was my parser bug), but still a weak case definition. |
| C2 | Corrected-claims **case 04** expects **"(Operational)"**, which names four documents. | Open. Passes now under exact identity + supplied-text support, but should name its document. |
| C3 | **Every citation pass is provisional.** The check proves the cited document was supplied and carries a required phrase — necessary, not sufficient. | Open by design; now labelled in the scorer. Making it conclusive needs a claim-level entailment check that does not exist. |
| C4 | **Review coverage.** F1 122/123 risk claims read, F0 109/112; 4 named claims still unread. **631 machine-UNRESOLVED and 495 machine-`auto-supported` remain unread and unverified.** Earlier versions overstated this as "all 123 read". | **Open**, quantified in `review-ledger-s7.md`. |
| C4-old | (superseded) **Review coverage shortfall.** Population 1,255 occurrences / 990 distinct. Read: the 123 risk-category (CHECK-\*) occurrences. **Not read: 631 machine-UNRESOLVED and 495 machine-`auto-supported`.** The instruction was to review all partial claims; under the wider splitter the partial band grew to 428 and only those the engine surfaced were read. | **Open shortfall**, stated in REPORT §20.3. |
| C5 | The engine's `auto-supported` rule has **not** been validated against reading, so it carries no evidential weight. Its `CHECK-NUMBER` rule produced 5 false flags (top-3 window, number tokenisation). | Open. |
| C6 | Claims whose actor is inferred from a manual's audience rather than stated: recorded as **supported-with-qualification** (11 occurrences), not as supported. | Open, visible in the ledger. |

## D. Measurement hygiene

| # | item | status |
|---|---|---|
| D1 | Observed pass/fail disagreement on identical supplied excerpts: **18 of 261 paired runs** in S7, 25 of 297 in S6. Single-run deltas on these suites are not evidence. | Standing caveat. |
| D2 | Two published figures were wrong and are corrected: 228→**261** paired runs; "46 cases"→**23 runs carrying 46 flags**. | Corrected in REPORT §17 in place and in §18. |
| D7 | **Tooling false-finding pattern — three instances.** em-dash header parser (46 phantom flags), negated-`XREF` rule (a note contradicting its own claim), body-only search (two false "unsupported" findings). Each was caught by the reviewer, not by me. | Search now covers headers; all three fixed. Treated as a pattern. |
| D5 | My `XREF` auto-rule matched "same as" inside a **negation** and attached a note contradicting the claim (`sms-office-1`). Fixed; the verdict was right, the reason was not. | Fixed. |
| D6 | `pmsoffice-5` verdict said the two passages share the "same action"; they differ in **both** screen and environment. Downgraded to supported-with-qualification. | Corrected. |
| D3 | My excerpt-header parser split document names at the first em dash, making every KB-pilot citation look unsupplied. | Fixed (judge `.9`). It had manufactured all 46 review flags. |

## D4. Counts corrected this round

| was published | correct |
|---|---|
| "Completed citation review" | screening plus partial review |
| "three unsupported claims" | three unsupported **identified among those reviewed**; only 2 were in the flagged set |
| Section A "8 rows" | 8 grouped findings covering **9 occurrences** |

## E. Decision state

- **Live unchanged.** Nothing deployed; nothing pushed. Candidate containers `f0` :8034 and `f1` :8035 plus the
  earlier sets are still running and stop on the owner's word.
- **Promote nothing yet.** The corrected arm is level or better on every suite except the single work-order case
  that carries the real defect A1.
- Prompt **v6 remains held**.
