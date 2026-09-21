# For Astra — seventh pack, 19-Sep: counts reconciled, review finished, routing split in two

No model calls, no deployment, no reindex, no application-authentication change. Live untouched; v6 held.

**Your five points, all accepted:**

1. **Count overstated — confirmed and corrected.** 117 recorded (73 F1 + 44 F0), not 123; F1 had left 56
   CHECK-* claims unread. Now **F1 122/123, F0 109/112**, 277 verdicts recorded, and the 4 still unread are
   named individually in the ledger.
2. **Both review decisions corrected.** `sms-office-1` — my XREF rule matched "same as" inside a negation and
   wrote a note that contradicted the claim; verdict stands, reason replaced, rule fixed. `pmsoffice-5` — the
   two passages differ in **both** screen and environment, so downgraded to supported-with-qualification.
3. **"Root cause proven" withdrawn.** What is proven is the **recognition gap**. The proposal is now split into
   Change A (title matching) and Change B (clarification guard), each with its own offline test, and Change B
   is measured on three outcomes — correct / clarify / wrong-module — never two.
4. **Wording corrected** to yours: "On the office instance BOTH Generate Now and per-job Generate WO require
   the switch; unplanned creation does not." Ship-side per-job added explicitly.
5. **Routing code and captured input included** (`routing-evidence/`) so you can check the claim yourself.

**Two new findings this round, both on the pre-change arm:** `certsurveys-2` turns a "Mandatory field" marker
into "the record cannot be saved"; `fn-2` claims Lesson Learnt shares the steps when "Lesson Learnt" is absent
from the supplied text. Same shape as the hist-1 audience-label error.

| file | what it is |
|---|---|
| `review-ledger-s7.md` | **start here** — coverage stated first, verdicts grouped, unread claims named |
| `review-verdicts.json` | the 277 verdicts, keyed by claim id |
| `ROUTING-PROPOSAL-v2-two-changes.md` | the split proposal; supersedes the v1 file, which is included for the trace |
| `routing-evidence/` | the routing code, the title-term proof, and hist-1's complete captured input |
| `DOC-ERROR-both-refusals.md`, `PROPOSED-FIX-switch-scope.md` | wording corrected |
| `OPEN-ISSUES.md` | register, with the new findings and the review-coverage item |
