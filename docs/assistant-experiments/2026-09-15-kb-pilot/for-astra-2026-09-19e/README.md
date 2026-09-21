# For Astra — eighth pack, 19-Sep: counts closed, two findings retracted, routing rebuilt

No model calls, no deployment, no reindex, no auth change. Live untouched; v6 and the clarification guard on hold.

**Your five points:**

1. **Counts confirmed** — 277 = 150 F1 + 127 F0. The four outstanding risk claims are now read:
   **F1 123/123, F0 112/112, 281 verdicts.** The wider review is still incomplete and says so: 1,203
   machine-UNRESOLVED and 983 machine-`auto-supported` occurrences remain unread and unverified.
2. **Change A withdrawn.** You are right that "audit history" already resolves via the `audit` alias and that
   the real question says "inspection history". v2 admitted the limitation and then required that question to
   pass — an unsatisfiable, self-contradictory condition. Withdrawn.
3. **Rebuilt around your two findings** (`ROUTING-PROPOSAL-v3.md`). R1 reproduced — and **measured as latent**:
   no ambiguous term exists on the current corpus, so it misroutes nothing today. R2's code path is proven; the
   offline test of whether it ever fires is named and **not yet run**. **Neither fixes `hist-1`**, and I no
   longer claim a root cause for it.
4. **Comparison correction now on both arms.** All ten `pmsoffice-5` occurrences read
   supported-with-qualification, distinguishing a valid comparison of two *different* screens from an
   unsupported claim about *equivalent* screens.
5. **Both new findings retracted.** `certsurveys-2` is supported — the manual says "Mandatory fields (*) must
   be completed before the record can be saved", and my claim was its contrapositive. `fn-2` is supported — the
   Lesson Learnt manual p.7 **was** supplied; the words are in the excerpt header, which my search excluded.
   **`hist-1` reframed:** wrong feature, not audience-label inference — the capture does say the interface
   "are applicable to the Office side".

That is the **third** false finding from my own tooling in this workstream. Recorded as a pattern (D7), not as
three unrelated slips. **Two real answer defects remain, not four.**

| file | what it is |
|---|---|
| `review-ledger-s7.md` | coverage first, then verdicts; every retraction marked |
| `review-verdicts.json` | 281 verdicts keyed by claim id |
| `ROUTING-PROPOSAL-v3.md` | rebuilt; v2 included for the trace |
| `routing-evidence/` | routing code, title-term proof, hist-1 capture, and the R1/R2 reproductions |
| `OPEN-ISSUES.md` | register, with A6 closed as a false finding and D7 added |
