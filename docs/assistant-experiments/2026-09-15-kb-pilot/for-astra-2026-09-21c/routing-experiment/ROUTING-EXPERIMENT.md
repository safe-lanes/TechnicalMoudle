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

### 1.3b The change count was a counting bug, and R6c's cost was understated

`analyse.py` counted only **removed** excerpts, so a rule that merely adds material reported
"0 questions changed". Added excerpts change what the model sees just as much. Both directions are now
counted and reported as `-removed +added`.

Corrected, **R6c adds 31 excerpts across 24 questions and removes none** — not the 26 I reported. The
reviewer's figures are confirmed exactly.

**"Breaks nothing" is withdrawn as a claim.** What is established is narrower: *no existing excerpt is
removed*. Extra material can still mislead an answer, and earlier experiments in this workstream showed
exactly that risk. Whether anything breaks is what the answer test in §4 is for.

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
`MODULE_LABELS.get(h.module, h.module)` per hit. **Now implemented in the candidate and verified in
§4: 579 of 579 citations correctly labelled, including every cross-module one.**

---

## 2. Results, corrected

```
rule                                           correct  clar  wrong   page-level  file-only  questions changed (-removed +added)
R0  current (shipped f1 config)                    100     0      1    62 of 65     65 of 67         0 of 101  (-0 +0)
R1a second opinion, gap 0.10                       100     0      1    62 of 65     66 of 67         7 of 101  (-7 +7)
R1b second opinion, gap 0.15                       100     0      1    62 of 65     66 of 67        12 of 101  (-12 +12)
R1c second opinion, gap 0.25                       100     0      1    61 of 65     66 of 67        24 of 101  (-24 +24)
R2a clarify when runner-up within 0.10              93     7      1    58 of 65     61 of 67         7 of 101  (-33 +0)
R2b clarify when runner-up within 0.15              89    12      0    54 of 65     57 of 67        12 of 101  (-57 +0)
R3a joint vector+lexical module score, alpha 0.7     100     0      1    62 of 65     65 of 67         1 of 101  (-4 +1)
R3b joint vector+lexical module score, alpha 0.5     100     0      1    62 of 65     65 of 67         1 of 101  (-4 +1)
R4  UI context outranks vector routing             100     0      1    63 of 65     67 of 67         2 of 101  (-8 +9)
R5a evidence not module-scoped (global top 5)      100     0      1    62 of 65     67 of 67        24 of 101  (-28 +35)
R5b per-module second opinion, gap 0.15            100     0      1    62 of 65     66 of 67        12 of 101  (-9 +12)
R5c per-module second opinion, gap 0.25            100     0      1    62 of 65     67 of 67        24 of 101  (-26 +31)
R6a per-module, appended not displacing, gap 0.25     100     0      1    62 of 65     66 of 67        24 of 101  (-0 +24)
R6b per-module, appended not displacing, gap 0.15     100     0      1    62 of 65     66 of 67        12 of 101  (-0 +12)
R6c per-module, appended, gap 0.25, 2 slots        100     0      1    63 of 65     67 of 67        24 of 101  (-0 +31)
R6d per-module, appended, gap 0.25, 3 slots        100     0      1    63 of 65     67 of 67        24 of 101  (-0 +35)
```

Page-level failures under the current rule: `hist-1`, `prep-3`, `sms-office-1`.

**Why R5a and R5c gain nothing at page level.** Each fixes `hist-1` and breaks `manuals/inc-1`: the
Audit History p.9 chunk takes the fifth slot and pushes out *Incident p.18 "Part K: Office Closeout"*,
which is the actual answer to "can a vessel user close an incident themselves". Cross-module widening
was displacing correct in-module evidence — the lost evidence the reviewer asked to be checked for, and
it was real.

**R6c** is the same widening with the displacement removed: the nearest chunk of each other module
inside a 0.25 gap is **appended** rather than substituted. It fixes `hist-1` at page level, removes no
existing excerpt, and adds **31 excerpts across 24 questions**. A third appended slot (R6d) adds 4 more
and gains nothing further. "Breaks nothing" is NOT claimed from this table — only that nothing is
removed; whether the extra material misleads an answer is what §4 tests.

The clarification guard remains the worst option measured: seven new clarifications and four lost
passages at gap 0.10, twelve and eight at 0.15. It should stay on hold.

---

## 3. The one remaining wrong module selection in this experiment

"One remaining defect" was too broad and is corrected. What is measured here is **one incorrect module
selection out of 101 questions**. It is not a statement about the assistant's open defects generally:
the work-order switch contradiction, the missing passages (`prep-3`, `sms-office-1`) and the unresolved
claims from the citation review all remain open and are unaffected by anything in this experiment.


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

### The answer test — RUN. 34 questions × 2 arms × 3 runs = 204 responses, 0 errors

Baseline `sail-assistant-py-f1` (unchanged, served shape) against candidate `sail-assistant-py-g1`
(new container, port 8036, image `v6-r9`), same model `gpt-5.6-luna`, same prompt v5, same index
`kb-pilot-e`. Test set = the 24 questions whose excerpts change + the 12 frozen cases + the 2
explicit-module conflict cases (union 34). **Nothing deployed; f1, f0 and all 33 other containers
untouched — verified by start time.**

**1. The Audit History answer is fixed, 3 runs of 3.**

| | answer | citation |
|---|---|---|
| baseline | *"The Office is allowed to add comments… The **Review Work Order** interface… the ship submits the work for office review"* | Technical PMS p.13, Ship-Side notes §1.1.13.3 |
| candidate | *"Only office users are allowed to add comments in the Review section **of an inspection history record**"* | **Audit** – History Manual §3.3 "Review Page" p.16 |

The baseline answers from the work-order review procedure in all three runs. The candidate answers
from the Audit History page in all three, cites it, and borrows no work-order instructions.

**2. Module selection is unchanged.** Baseline 33/34 and candidate 33/34 correct in every run — the
one miss is `hist-1`, which is still *labelled* Technical by design, because R6c widens the evidence
and deliberately does not touch the routing decision.

**3. Citation labels: candidate 579 of 579 correct, including every cross-module citation.** Baseline
scored 486 of 486 — which confirms the defect is **latent rather than observable today**: every
baseline excerpt comes from the routed module, so stamping the routed module happens to be right. The
fix is what makes the cross-module citations correct, and without it R6c would have mislabelled 31.

**4. No Technical procedure was presented as Safety functionality.** The sharpest case is
`fresh-ctx-conflict-1` — "In the Safety module, how do I add a new component?" — which is routed to
Safety and now also receives the Technical component-tree page. All three runs state *"not covered in
the Safety documentation"* and attribute the Technical material explicitly to the Technical PMS manual.
That is the agreed policy, and it is arguably better than the baseline, which simply said it was not
covered. The other Safety-routed cases that gain Technical evidence (`moc-office-1`, `ra-office-1`,
`ra-office-3`) answer from Safety exactly as before.

**5. Text diffing is useless here, and my first cut of this measure was wrong.** "102 of 102 answers
differ" measures model non-determinism, not the candidate: **baseline-vs-baseline text similarity is
0.544** across runs. The meaningful control is the 10 test questions whose excerpts R6c does *not*
change — there, baseline-vs-candidate similarity is **0.518 against a baseline-vs-baseline 0.522**,
i.e. indistinguishable from noise. The candidate does not perturb answers it does not feed.

**6. Cost.** Excerpts per answer 4.76 → 5.68. Added context measured from the index: **21,616
characters across 31 appended excerpts over 24 questions**, ≈5.4k tokens total at 4 chars/token, so
roughly **225 extra tokens on an affected question** (estimate — the API returned no `usage` field in
this run, and the outbound capture file was not written because the container user cannot write the
mounted directory). Latency median **3355 ms → 3210 ms**, p90 5607 → 5909 ms: no increase beyond
run-to-run variance.

**7. One quality observation, not a failure.** `answers/1` gains a filtering preamble and grows from
~400 to ~625 characters, but keeps the Excel export, the vessel comments column and Save in all three
runs and still cites Audit Preparation p.15. Extra evidence made it more verbose, not wrong.

### A separate small finding

The identity tuple the shipped code uses to deduplicate excerpts — `(file, breadcrumb, chunk_index)`
in `second_opinion`, `guarded_lexical_rescue` and `score_fuse` — is **not unique**: 921 chunks yield
919 distinct tuples. Adding `page_number` makes it unique. Two chunks can therefore be mistaken for
one another during dedup. Low impact, not fixed, reported for the record.

### What is still not established

- **34 of 101 questions were re-run, not all of them.** The other 67 are unchanged by R6c at retrieval
  level, but their answers were not re-measured.
- Three runs per arm on a highly non-deterministic model. A fourth run could differ.
- "No harm observed" is not "no harm". Every changed answer was read; none degraded. That is a reading
  over 24 questions, not a guarantee.
- The two page-level misses that R6c does **not** fix — `prep-3` and `sms-office-1` — remain open, and
  so do the work-order switch contradiction and the unresolved citation-review claims.

### What the answer test had to show

Per the brief, the test covers Audit History, the questions whose excerpts change, and explicit-module
conflicts, and it must show all three of:

- the model uses the correct **Audit** procedure for `hist-1` — not merely that the page was supplied;
- the other answers are **preserved** — the 26 questions that gain an excerpt, plus the frozen set;
- every citation carries **its own source's module**, not the routed one.

Supplying the page is not the result. **All three are met** — see the run above. Nothing is deployed:
the candidate lives only in container `sail-assistant-py-g1` on port 8036, and the source change is
flag-gated (`ASSISTANT_CROSS_MODULE_GAP` defaults to 0, which is exactly today's behaviour).

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
