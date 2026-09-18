# Reply to the review of 18-Sep — evidence you asked for, and what reading it changed

No new model calls were made. Nothing was deployed. Live, nginx, the SMS RAG service and every other site are unchanged.

## Your counting correction — accepted

The judge validation changed **270 component results** but **220 overall pass/fail verdicts**. The brief quoted the component figure as if it were the verdict figure. Both are now published.

## 1. Case 06 — you were right, and it is worse than a scoring problem

The two sources supplied in the same request contradict each other:

- corrected code-derived document, Recent Updates §1.1.14.6: "**Only a Sail Admin can generate work orders directly from the office**, and only for a vessel whose 'office work-order generation' switch is enabled."
- KB pilot file, "How work orders are created": "office 'Generate Now': Sail Admin only; (2) per-job 'Generate WO': **no role check**; (3) unplanned: no role check."

Per-job Generate WO is also performed from the office, so the blanket sentence is over-broad. Reading all nine stored runs:

| arm · run | answer | verdict |
|---|---|---|
| B0 r1 | "From the office, only a Sail Admin can generate work orders", then only Generate Now | **over-broad — real defect, judge passed it** |
| D5 r2 | same blanket claim, then only Generate Now | **over-broad — real defect, judge passed it** |
| B0 r2, r3 · D5a r1, r2 · D5 r1, r3 | split by action: Generate Now = Sail Admin only; per-job = no role check | correct |
| D5a r3 | split by action | correct answer, failed on a scoring defect (§2) |

Three consequences, none needing a model call:

1. **The case expectation is defective.** Requiring "sail admin" without requiring the per-action split rewards the over-broad answer. Proposed change: require the Generate Now role rule **and** the statement that the per-job route has no role check, and forbid presenting Sail Admin as the condition for all office generation. This makes the case harder, so it is proposed, not applied.
2. **The corrected document itself needs a correction** — §1.1.14.6 should read "only a Sail Admin can use the office **Generate Now** action". That is a documentation change for the owner to approve.
3. Two stored runs are real answer defects that the current judge passes, so the corrected-claims figures in the brief are optimistic by one case on the baseline and one on the v6 arm.

The judging rule you asked for, verbatim from `acceptance_generated.py`:

```
("gen", "Who can generate work orders from the office, and what happens if the vessel's switch is off?",
 "technical", "Recent Updates", None, ["sail admin", "not enabled"], NOT_COVERED,
 "R3 §1.1.14.6: only a Sail Admin; message says not enabled for the vessel; other roles refused
  (workOrderGenerationGate.ts:44,141-161)."),
```

`NOT_COVERED` = "not covered", "isn't covered", "not documented", "does not cover", "no information".

## 2. The corrected-claims losses are scoring defects — with the sentences that caused them

| case · run | sentence that failed it | why it is not an answer defect |
|---|---|---|
| 06 · D5a r3 | "the June PMS user manual excerpt only defines work orders and **does not cover** these office-generation rules" | an accurate statement about one source, which the prompt asks for. The forbidden list exists to catch the assistant declining |
| 07 · D5a r3 | "those capabilities are **not covered** as available to that role" | this is the substance of the correct "No" answer, not a refusal |

A narrow rule — ignore a not-covered phrase scoped to a **named source**, keep it when the answer declines outright — is proposed, not applied, because it would move published scores. By reading, corrected claims become baseline 11, routing candidate 12, v6 arm 11, reversing the automatic 12 / 10 / 12.

## 3. The remaining work-order failure is a scoring defect

D5, wo-phr-04 run 1, judged "Generate WO switch stated without the office qualifier". The answer says, in that step: "In the **Office**, select the vessel and ensure its **office work-order generation switch is ON**. This switch is not required on the Ship." The qualifier is present; the judge's scope window missed it. By reading, that arm is 8/8 on work orders.

The genuine content gaps in this run are on the baseline: no overview at all on wo-generic-03 in all three runs, and no note of the other methods on wo-phr-02 in two runs.

## 4. The manual-coverage losses are scoring defects

| case · run | required phrase | what the answer said |
|---|---|---|
| crewing-1 · D5a r1 | "recruitment application" | answered both halves of the question; the form's name was not asked for |
| fn-1 · D5a r1 | "all actions" | "…status for **all pending actions**" |

## 5. The fresh set — your point stands, and it moves against the baseline

Read against each case's own rubric, the module-context conflict case reverses:

| arm | what happened | rubric verdict |
|---|---|---|
| baseline | routed to **Technical** and gave the Technical add-component procedure, noting the Safety framing is not covered | **fails** — the rubric allows routing to Safety and saying it is not covered there, or asking which module is meant |
| both candidates | routed to **Safety**: "Adding a new component to the component tree is not covered in the provided Safety documentation" | correct |

The runner passed the baseline because this case has no required phrases and its expected module is deliberately "Safety or a clarification", which the runner does not score. By reading, the fresh set is **baseline 8/10, both candidates 10/10**.

## 6. Where the comparison stands after reading

| suite | baseline automatic → read | routing + guarded rescue (v5) | same on v6 |
|---|---|---|---|
| corrected claims 14 | 12 → **11** | 10 → **12** | 12 → **11** |
| work orders 8 | 5 → 5 | 7 → 7 | 7 → **8** |
| fresh validation 10 | 9 → **8** | 10 → 10 | 10 → 10 |
| routing 13 / retrieval 18 | 8 / 18 | 13 / 18 | 13 / 18 |

Every difference examined moves the same way: the baseline's failures are content gaps, the candidates' are wording and scope artefacts of the judges.

## 7. Position

Unchanged: **deploy nothing**, hold v6, keep live untouched. Two items now block any promotion decision and neither needs a model call:

1. Correct the case-06 expectation, and decide the over-broad sentence in the corrected document (owner's call).
2. Settle the two judge defects above before any score is quoted as final.

## Files in this folder for these points

| file | contents |
|---|---|
| `s5-full-answers-corrected-claims.txt` | cases 1, 4, 6, 7 — every run on all three arms, full answers plus the complete captured model input |
| `s5-full-answers-work-order.txt` | wo-generic-02 and wo-phr-04, same format |
| `s5-full-answers-manual-coverage.txt` | the nine cases that differ between arms, same format |
| `s5-full-answers-fresh-validation.txt` | all ten fresh cases, all arms, same format |

Each block shows the case, its judging rule, the automatic verdict, the citations the user sees, the excerpts exactly as sent to the model, and the whole answer.
