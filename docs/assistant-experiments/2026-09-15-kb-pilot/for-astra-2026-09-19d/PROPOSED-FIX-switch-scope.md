# Proposed fix (ONE, targeted) — state the switch's scope wherever the role's exclusivity is stated

Requested by the reviewer: after the citation review, propose **one** targeted fix for the remaining real
defect, rather than expanding scoring rules further. **Nothing here is applied.** Applying it needs a re-index
and a re-run, which means new model calls and the owner's approval.

## The defect

`wo-phr-05` F1 run 3 requires the office switch for per-job 'Generate WO' in its steps and then concludes:

> "the office switch **and Sail Admin restriction** apply only to the relevant planned-generation actions, **not
> to per-job Generate WO** or unplanned work orders."

Only the Sail Admin restriction is exclusive to 'Generate Now'. The switch applies to **both** office routes.
The same conflation appears once more, on a historical arm (`s4 · wo-generic-03 · D2-hybrid r3`).

## Where it comes from — traced, not guessed

**What the failing run was actually supplied** (from its captured input) was correct:

> "Exceptions / edge cases: The **Sail Admin requirement** belongs to 'Generate Now' only; it does not apply to
> per-job 'Generate WO' or to unplanned work orders."

That sentence scopes only the role. The model widened it to include the switch. So the immediate cause is the
answer, not that source line.

**But the corpus contains a sentence that says the wrong thing outright, and I wrote it.** R5 §1.1.14.6.2, added
in this work:

> "**Both refusals belong to 'Generate Now' only.** The per-job 'Generate WO' route and the unplanned route are
> covered in the sections below and have different conditions."

There are two refusals in that section: the role refusal and the **switch** refusal. The switch refusal is *not*
exclusive to 'Generate Now' — the per-job route returns the same message when the switch is off
(`kb/technical/work-orders/office-generate-wo-per-job.md`: "With the switch off the request is refused with
'Office work-order generation is not enabled for this vessel.'"; `jobService.ts` → `isOfficeWoGenerationEnabled`).
That sentence was not in the five excerpts supplied to the failing run, but it is in the index and it asserts
precisely the conflation the answer made.

## The fix — one change, made in the two places that state the exclusivity

**1. `generated-docs/build_r5.py`, §1.1.14.6.2, replace:**

> Both refusals belong to 'Generate Now' only. The per-job 'Generate WO' route and the unplanned route are
> covered in the sections below and have different conditions.

**with:**

> The **role** refusal belongs to 'Generate Now' only. The **switch** refusal does not: the per-job 'Generate WO'
> route requires the same vessel switch and returns the same message when it is off. On the office instance BOTH 'Generate Now' and per-job 'Generate WO'
> require the switch; unplanned creation does not. On a ship instance neither route requires it. [code: jobService.generateWorkOrder → isOfficeWoGenerationEnabled, the same check
> evaluateDirectGeneration uses]

**2. `kb/technical/work-orders/how-work-orders-are-created.md`, exceptions line, append:**

> The office work-order generation switch, by contrast, applies to **both** office routes — 'Generate Now' and
> per-job 'Generate WO' — and only unplanned creation is exempt. On a ship instance neither route requires the switch.

That is the whole change: make the switch's scope explicit at every point where the role's exclusivity is
stated, so the two conditions can no longer be read as one.

## Why this and not something else

- It corrects a statement in the corpus that is **factually wrong**, independent of any test. That alone
  justifies it.
- It targets the mechanism of the observed defect — the two conditions being introduced together and excluded
  together — rather than the wording of one answer.
- It changes no scoring rule. The work-order judge's contradiction test stays exactly as it is, so the defect
  remains detectable if it recurs.

## What it does not do, and how it would be verified

- It is **not** established that this fix removes the contradiction. The failing run did not have the wrong
  sentence in front of it, so the fix addresses a corpus error and a plausible contributing cause, not a proven
  one. Evidence class: **READ**.
- Verification would need: re-index one document and one KB file into a fresh isolated set, and re-run the
  work-order suite (8 cases × 3 runs × 2 arms ≈ 48 answers) against the current arm. That is a new model-call
  round and is **not** started.
- A negative result would be informative: if the contradiction survives with the corpus corrected, the cause is
  the model's handling of paired conditions, and the next step would be prompt-level, not content-level.
