# Bounded retrieval experiment — where the module decision actually loses the passage

Run 21-Sep-2026 against the reviewer's brief. **One embedding call per question (101 total,
`text-embedding-3-large`, the production model). No chat/answer model calls. No re-index. Nothing
deployed. No container restarted, no database row written. The live service and every other container
were untouched.**

Index `kb-pilot-e` (921 chunks), read through the candidate container `sail-assistant-py-f1`
(`ASSISTANT_INDEX_SET=kb-pilot-e`, `ROUTE_INTENT=on`, `HYBRID=rescue`, floor 1.15, margin 0.07,
top_k 10, 5 excerpts, second-opinion gap 0).

Stored query vectors: **none exist.** The chat turn writes conversations, pairs, ratings and
notifications, and never persists the embedding. So "reuse stored vectors where available" resolves to
zero reuse; all 101 were computed. That is stated here rather than left for the reader to discover.

---

## 1. Three retractions — all four of the reviewer's challenged claims fell

### 1.1 "No Audit chunk reached the distance limit" — **FALSE, and it was the load-bearing claim**

Measured, not inferred. For the `hist-1` question, unchanged:

```
nearest chunk of every module, whole corpus, floor = 1.15
   technical  0.8754  inside floor   p.2   1.1.13.3 Approvals as Seen From the Ship
   safety     1.0019  inside floor   p.10  Part D: Any Other Improvement Suggestion
   audit      1.0204  inside floor   p.16  3.3 REVIEW PAGE:          <-- the expected passage
   incident   1.0247  inside floor   p.11  6. OFFICE CLOSEOUT
   crewing    1.0796  inside floor   p.54  Preamble
```

The correct Audit passage is **inside the floor and is rank 5 of the vector top-10 that `route()`
actually receives**. Recall does not fail. My earlier report said "vector recall FAILS silently… no
Audit chunk lands inside the 1.15 floor", labelled INFERRED from the stored citations. The reviewer was
right that citations cannot show what was available before routing. The inference was wrong.

The same two numbers (0.875 / 1.020) are already written in the shipped docstring of
`retrieval.second_opinion`. They were in the repository the whole time. I did not check that before
writing the diagnosis.

### 1.2 "The lexical channel would have found it" — **does not survive the real question**

That demonstration used a hand-written query. With the user's own question the unscoped lexical ranking
leads with **Safety — Master Review Manual** (2.20); the Audit review page is 5th (1.80). A module rule
that trusts the lexical leader therefore picks Safety. Measured below as R3: it routes `hist-1` to
**Safety** and fixes nothing. The reviewer predicted a wrong module would simply be swapped for another
wrong module; that is exactly what the measurement shows.

### 1.3 "The question's words are not in the corpus" — **withdrawn as an explanation**

It is true that "inspection history" appears 0 times, but since recall demonstrably succeeds, the
observation explains nothing about this failure. Accepted and dropped.

### 1.4 "Swapping two calls is the fix" — **withdrawn**

Reordering `route()` and `search_lexical` does not define how the two channels jointly choose a module.
When a joint rule is written down precisely and measured (R3), it does not help.

---

## 2. What the experiment actually did

All 101 stored questions, **verbatim** — the suite text, never rewritten. Ground truth is the module
each suite declares (for the manual-coverage suite, the module prefix of the expected document, exactly
as `acceptance_manuals.py` derives it). For each question: one embedding, then the unscoped vector
top-50, the nearest chunk of **every** module over the whole corpus, the unscoped lexical top-50 built
from the question's own words with the shipped OR-of-terms query, and the nearest chunks of the expected
document. `route()`, the guarded lexical rescue and `second_opinion` are reproduced from the shipped
source over that captured input.

Two things are reported for every rule, because the module alone is not the outcome that matters:

- the **three outcomes separately** — correct-module answer · clarify · wrong-module answer;
- whether the **expected document's passage is among the supplied excerpts** (67 cases name one).

`excerpt slots changed` is the disruption cost: how many of the 467 excerpt slots the current
configuration fills would be replaced.

---

## 3. Results

```
rule                                            correct  clarify  wrong  not-doc   passage supplied   slots changed
R0  current (shipped f1 config)                      98        0      3        0        65 of 67        0 of 467 (0%)
R1a second opinion, gap 0.10                         98        0      3        0        66 of 67        7 of 467 (1%)
R1b second opinion, gap 0.15                         98        0      3        0        66 of 67       12 of 467 (3%)
R1c second opinion, gap 0.25                         98        0      3        0        66 of 67       24 of 467 (5%)
R2a clarify when runner-up within 0.10               92        7      2        0        61 of 67       33 of 467 (7%)
R2b clarify when runner-up within 0.15               88       12      1        0        57 of 67       57 of 467 (12%)
R3a joint vector+lexical module score, alpha 0.7     98        0      3        0        65 of 67        4 of 467 (1%)
R3b joint vector+lexical module score, alpha 0.5     98        0      3        0        65 of 67        4 of 467 (1%)
R4  UI context outranks vector routing              100        0      1        0        67 of 67        8 of 467 (2%)
R5a evidence not module-scoped (global top 5)        98        0      3        0        67 of 67       28 of 467 (6%)
R5b per-module second opinion, gap 0.15              98        0      3        0        66 of 67        9 of 467 (2%)
R5c per-module second opinion, gap 0.25              98        0      3        0        67 of 67       26 of 467 (6%)
```

**Wrong-module answers are rare: 3 of 101 under the current rule.** Any proposal has to be judged
against that base rate, not against the impression left by one memorable failure.

### The clarification guard is expensive — measured, as the reviewer asked

R2a buys one fewer wrong answer for **seven** new clarifications and four lost passages. R2b buys two
for **twelve** and eight. On this corpus the guard costs far more than it saves. It should stay on hold.

### The joint keyword+semantic module score does not work

R3 is a precise rule — per module, `alpha · (1 − best_distance/floor) + (1 − alpha) · normalised best
lexical score`, floor-gated, clarify below a margin. At both weightings it leaves the totals exactly
where they were, and on `hist-1` it moves the answer from one wrong module (Technical) to another
(Safety). This is the reviewer's point 4, confirmed by measurement rather than accepted in principle.

### `second_opinion` already exists — and does not fix this case

It is in the shipped code, disabled by default (`gap 0.0`), with a docstring naming this very question.
It takes `min(other)` — the single nearest non-routed chunk — which for `hist-1` is the **Safety** chunk
at 1.0019, not the Audit page at 1.0204. So it supplies the wrong other-module passage. R5b/R5c offer
the nearest chunk of *each* other module inside the gap instead, which does supply the Audit page.

---

## 4. The three wrong cases have three different causes

| case | expected | got | cause |
|---|---|---|---|
| `manuals/hist-1` | audit | technical | **Module scoping.** The right passage is an in-floor candidate at rank 5 and is discarded *only* because it belongs to another module. |
| `fresh/fresh-ctx-conflict-1` | technical | safety | **The explicit-name rule itself.** The question says "In the Safety module, how do I add a new component to the component tree?" — components are Technical, and vector routing puts Technical first at 0.9317. The name overrides it. |
| `fresh/fresh-ctx-1` | technical | safety | **Recall, not routing.** The expected Technical passage is at 1.3568, outside the 1.15 floor. No routing rule can reach it. |

Only the first is a module-selection defect. Reporting all three as "routing" would be wrong.

### The named-module rule, measured over all 101

- 46 of 101 questions name a module.
- The R2 path — a named module with **no** candidate inside the floor — fires **0 times**. Stated as the
  reviewer asked: *no wrong-module outcome was observed in the questions checked*. Not "cannot affect
  current use".
- The name changed the routed module exactly **once**, and that once it produced the **wrong** module.
  One case is a data point, not a pattern; a second would be needed before calling the precedence rule
  harmful in general.

---

## 5. What I am not claiming

- **Supplying the passage is not answering correctly.** R5a/R5c put the Audit page in front of the model.
  Whether the answer then changes is **not measured** — that needs a live run, which the brief defers.
- **R4 is contaminated and must not be read as a result.** Every suite sends
  `context={"module": <the case's own module>}`, so in this harness the UI context *is* the right answer.
  R4 scoring 100/101 is an artefact of the harness. It says nothing about production, where the context
  is wherever the user happens to be. It is in the table only because leaving it out would hide that the
  harness carries the answer.
- **R5a changes 6% of excerpt slots.** Cross-module evidence displaces routed-module evidence; the
  passage metric cannot see quality lost inside the correct module.
- One index set, one embedding model, one corpus snapshot. Not repeated.

## 6. Evidence classes

- Distances, ranks, per-module nearest chunks, lexical rankings, the 101-question tallies: **PROVEN**
  (measured this run; `candidates.json` ships with the pack).
- The rule reproductions: **PROVEN** against the shipped source, which is included for checking.
- Effect of any rule on answer text: **not measured.**
- The three retractions in §1: my earlier claims were **INFERRED** and are now **disproven**.

## 7. Reproducing

```
python build_cases.py                                    # 101 cases, reconciled against ledger.json
docker cp capture.py cases.json sail-assistant-py-f1:/tmp/
docker exec sail-assistant-py-f1 python /tmp/capture.py /tmp/cases.json      > candidates.json
docker exec sail-assistant-py-f1 python /tmp/capture_meta.py /tmp/cases.json > meta.json
python analyse.py                                        # the table above
python analyse.py --case manuals/hist-1                  # one case, every stage
```
