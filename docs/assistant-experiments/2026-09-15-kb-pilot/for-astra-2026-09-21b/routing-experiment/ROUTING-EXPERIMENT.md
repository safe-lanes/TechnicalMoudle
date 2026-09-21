# Bounded retrieval experiment — corrected after review

Run 21-Sep-2026; **corrected the same day after the reviewer reran the analysis and found two scoring
mistakes.** No new model calls were needed for the corrections — the same captured data was rescored.

**Scope: 101 embedding calls in total (the original capture), no chat/answer model calls, no re-index,
nothing deployed, no container restarted, no database row written. Live service untouched.**

Index `kb-pilot-e` (921 chunks), read through `sail-assistant-py-f1` (`ROUTE_INTENT=on`,
`HYBRID=rescue`, floor 1.15, margin 0.07, top_k 10, 5 excerpts, second-opinion gap 0). No stored query
vectors exist anywhere — the chat turn never persists the embedding — so nothing could be reused.

---

## 1. Corrections to my own previous numbers

### 1.1 The expected module was wrong on two cases — the headline was 98/101, it is **100/101**

I took each case's `module` field as the expected answering module. On the two context cases in the
fresh suite that field is the **originating widget module**, which is the opposite of what I recorded.
The suite says so in its own words:

| case | I recorded | correct | the suite's own words |
|---|---|---|---|
| `fresh/fresh-ctx-1` | technical | **safety** | *"the module chosen must be Safety (the originating module sent by the widget is technical and must not drag the question there)"* |
| `fresh/fresh-ctx-conflict-1` | technical | **safety** | *"ACCEPTABLE: route to Safety and state honestly that the Safety documentation does not cover adding components"* — the agreed policy: honour the module the question names and explain the mismatch |

Note `fresh-ctx-conflict-1` could not be fixed by deriving the module from the expected document
either: its expected file is the **Technical** manual, because that is the subject matter, while the
correct routing target is Safety. Both corrections are written into `build_cases.py` as an explicit
table with the quoted authority, not applied silently.

Consequences, all of them against my previous report:

- **The current rule is 100 correct / 0 clarify / 1 wrong, not 98/3.**
- **The "Technical search miss" is not a defect.** I reported `fresh-ctx-1` as a recall failure because
  the expected Technical passage sits at 1.3568, outside the floor. I was measuring the distance to the
  wrong module. Safety is the right module, it is selected, and the case passes. Withdrawn.
- **The "explicit-name rule produced the wrong module" finding is withdrawn too.** `fresh-ctx-conflict-1`
  routing to Safety is the agreed policy working, not a defect. My §4 table last round was wrong on two
  of its three rows.
- **Only one case remains wrong: `manuals/hist-1`.**

### 1.2 "67 of 67 passages" was a filename check — at page level it is **62 of 65**

`supplied_expected()` compared filenames only, so any other section of the right manual counted as the
expected passage. The reviewer's example is exactly right and is now measured: `manuals/sms-office-1`
receives 4.2, 4.2.1, 4.1.2 and two untitled chunks of the SMS manual — the file is present, the expected
page never is. It fails at page level under **every** rule tested.

Page level is now reported separately, over the 65 cases that name expected pages. **Under this measure
none of last round's proposals improved on the current 62 of 65, and some made it worse.** The "67/67"
headline is withdrawn.

### 1.3 "6% of slots" understated the blast radius

R5a changes the excerpt list of **22 of 101 questions**; R5c, 20; R1c, 24. Questions affected is now the
reported figure, with the ids listed by `analyse.py` so each can be checked.

### 1.4 The citation module label — confirmed in the shipped source

```python
def citations_of(routed: Routed) -> list[dict[str, Any]]:
    return [{"module": MODULE_LABELS.get(routed.module or "", routed.module), ...} for h in routed.hits]
```

Every citation is stamped with the **routed** module, ignoring each hit's own `h.module`. So a
cross-module excerpt is cited under the wrong manual's module. This is not only a risk for the
proposals: it is **already latent for `second_opinion`**, which is in the shipped code and does exactly
this whenever the gap is set above zero. Any cross-module candidate must carry a one-line fix —
`MODULE_LABELS.get(h.module, h.module)` per hit. Not implemented.

---

## 2. Results, corrected

```
rule                                           correct  clar  wrong   page-level  file-only   questions w/ changed excerpts
R0  current (shipped f1 config)                    100     0      1    62 of 65     65 of 67     0 of 101  (0 slots)
R1a second opinion, gap 0.10                       100     0      1    62 of 65     66 of 67     7 of 101
R1b second opinion, gap 0.15                       100     0      1    62 of 65     66 of 67    12 of 101
R1c second opinion, gap 0.25                       100     0      1    61 of 65     66 of 67    24 of 101
R2a clarify when runner-up within 0.10              93     7      1    58 of 65     61 of 67     7 of 101
R2b clarify when runner-up within 0.15              89    12      0    54 of 65     57 of 67    12 of 101
R3a joint vector+lexical module score, alpha 0.7   100     0      1    62 of 65     65 of 67     1 of 101
R3b joint vector+lexical module score, alpha 0.5   100     0      1    62 of 65     65 of 67     1 of 101
R4  UI context outranks vector routing             100     0      1    63 of 65     67 of 67     2 of 101   [CONTAMINATED]
R5a evidence not module-scoped (global top 5)      100     0      1    62 of 65     67 of 67    22 of 101
R5b per-module second opinion, gap 0.15            100     0      1    62 of 65     66 of 67     9 of 101
R5c per-module second opinion, gap 0.25            100     0      1    62 of 65     67 of 67    20 of 101
R6c per-module, APPENDED not displacing, 2 slots   100     0      1    63 of 65     67 of 67     0 of 101  (0 slots)
```

Page-level failures under the current rule: `hist-1`, `prep-3`, `sms-office-1`.

**Why R5a and R5c gain nothing at page level.** Each fixes `hist-1` and breaks `manuals/inc-1`: the
Audit History p.9 chunk takes the fifth slot and pushes out *Incident p.18 "Part K: Office Closeout"*,
which is the actual answer to "can a vessel user close an incident themselves". Cross-module widening
was displacing correct in-module evidence — the lost evidence the reviewer asked to be checked for, and
it was real.

**R6c** is the same widening with the displacement removed: the nearest chunk of each other module
inside a 0.25 gap is **appended** rather than substituted. It fixes `hist-1` at page level, breaks
nothing, loses no existing excerpt, and costs 26 extra excerpts spread over 101 questions. Three
appended slots (R6d) add 4 more excerpts and gain nothing further.

The clarification guard remains the worst option measured: seven new clarifications and four lost
passages at gap 0.10, twelve and eight at 0.15. It should stay on hold.

---

## 3. The one remaining defect

`manuals/hist-1` — *"Who is allowed to add comments in the Review section of an inspection history
record — the ship or the office?"*

The correct Audit page is retrieved at **rank 5, distance 1.0204, inside the 1.15 floor**, and is then
discarded because the router selected Technical (0.8754) and excerpts are hard-scoped to the routed
module. This is established and needs no further parsing.

---

## 4. The single candidate for an answer test

**R6c + the per-hit citation label.** One flag, one one-line fix:

1. append the nearest chunk of each other module within 0.25 of the routed module's best, up to 2 extra
   excerpts, never displacing a routed-module excerpt;
2. `citations_of` labels each citation with **its own** hit's module.

The module decision itself is left alone: `hist-1` would still be labelled Technical while carrying an
Audit excerpt cited as Audit. Whether that is acceptable presentation is a question for the owner, not
something this measurement can settle.

### What the answer test must show

Per the brief, the test covers Audit History, the questions whose excerpts change, and explicit-module
conflicts, and it must show all three of:

- the model uses the correct **Audit** procedure for `hist-1` — not merely that the page was supplied;
- the other answers are **preserved** — the 26 questions that gain an excerpt, plus the frozen set;
- every citation carries **its own source's module**, not the routed one.

Supplying the page is not the result. This test has **not** been run: it needs answer-model calls and a
container built with the flag, and nothing is deployed.

---

## 5. Evidence classes

- Distances, ranks, per-module nearest chunks, the corrected tallies, the page-level measure, the
  `inc-1` displacement: **PROVEN** (measured; `candidates.json` ships with the pack).
- The citation-label defect: **READ** — confirmed in the shipped source, not observed in a live response.
- Effect of R6c on answer text: **not measured.**
- **R4 must not be quoted as a result.** Every suite sends the case's own module as context, so the
  harness carries the answer. It is in the table only so that contamination stays visible.
- One index set, one embedding model, one corpus snapshot, not repeated.

## 6. Reproducing

```
python build_cases.py     # 101 cases, reconciled 101/101 against ledger.json, corrections applied
python analyse.py         # the table above; cases.json is overlaid onto the capture by id
python analyse.py --case manuals/hist-1
```
