# Document error, recorded separately from the model error

Two different faults were being discussed together. They are separated here, as instructed.

## The document error (mine, in R5)

`generated-docs/build_r5.py`, §1.1.14.6.2, second bullet:

> **Both refusals belong to 'Generate Now' only.** The per-job 'Generate WO' route and the unplanned route are
> covered in the sections below and have different conditions.

That section documents **two** refusals — the role refusal and the switch refusal. Only the **role** refusal
belongs to 'Generate Now'. The **switch** applies to the per-job 'Generate WO' route as well, and returns the
same message when it is off.

Evidence: `kb/technical/work-orders/office-generate-wo-per-job.md` — "On the OFFICE instance: the job's vessel
must have its 'office work-order generation' switch ON … With the switch off the request is refused with
'Office work-order generation is not enabled for this vessel.'"; `jobService.generateWorkOrder` calls
`isOfficeWoGenerationEnabled`, the same check `evaluateDirectGeneration` uses.

### Proposed text diff (for later candidate work — not applied)

```diff
--- a/central-assistant-py/generated-docs/build_r5.py
+++ b/central-assistant-py/generated-docs/build_r5.py
@@ §1.1.14.6.2 Office 'Generate Now' — the refusal messages
-    ("b", "Both refusals belong to 'Generate Now' only. The per-job 'Generate WO' route and the unplanned route are "
-          "covered in the sections below and have different conditions."),
+    ("b", "The ROLE refusal belongs to 'Generate Now' only. The SWITCH refusal does not: the per-job 'Generate "
+          "WO' route requires the same vessel switch and returns the same message when it is off. On the "
+          "office instance BOTH 'Generate Now' and per-job 'Generate WO' require the switch; unplanned "
+          "creation does not. On a ship instance neither route requires it. [code: jobService.generateWorkOrder → "
+          "isOfficeWoGenerationEnabled, the same check evaluateDirectGeneration uses]"),
```

and, for consistency at the other place that states the exclusivity:

```diff
--- a/kb/technical/work-orders/how-work-orders-are-created.md
+++ b/kb/technical/work-orders/how-work-orders-are-created.md
@@ Exceptions / edge cases
 Exceptions / edge cases: The Sail Admin requirement belongs to 'Generate Now' only; it does not apply to
-per-job 'Generate WO' or to unplanned work orders.
+per-job 'Generate WO' or to unplanned work orders. On the office instance BOTH 'Generate Now' and
+per-job 'Generate WO' require the office work-order generation switch; unplanned creation does not. On a ship
+instance neither route requires it.
```

Applying either requires a re-index and a re-run. Neither is done.

## The model error (separate, and not fixed by the above)

`wo-phr-05` F1 run 3 requires the office switch for per-job 'Generate WO' in its own steps and then concludes
that "the office switch and Sail Admin restriction apply only to the relevant planned-generation actions, not to
per-job Generate WO". That is a self-contradiction and it remains a **genuine failure** under work-order judge
`.13`.

**The failing run never received the erroneous sentence.** Its captured input contains the KB line, which is
correct and scopes only the role: "The **Sail Admin requirement** belongs to 'Generate Now' only; it does not
apply to per-job 'Generate WO' or to unplanned work orders." **Correcting the document is therefore not claimed
to fix the observed contradiction.** Evidence class: the document fault is PROVEN (the sentence is wrong and is
in the corpus); the causal link to this failure is **not established**.

A counter-example from the same corpus makes the point: `generated/6` F1 run 3 keeps the two conditions apart
correctly — "2. Per-job 'Generate WO' … In the office, the vessel's switch must be **ON**" and, separately,
"3. Unplanned work order … It does **not** require the office generation switch." Same sources, same run batch,
correct distinction. The defect is therefore intermittent phrasing, not a uniform misunderstanding, and a
content change alone should not be expected to remove it.

If the corrected corpus is ever run, a negative result is the informative one: if the contradiction survives,
the cause is the model's handling of paired conditions and the next step is prompt-level, not content-level.
