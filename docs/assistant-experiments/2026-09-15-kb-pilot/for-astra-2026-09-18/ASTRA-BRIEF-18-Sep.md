# Reviewer brief — owner brief of 18-Sep-2026 (candidate only; nothing deployed; neither candidate approved)

Self-contained for a reviewer with no repository access. Everything here was produced on candidate containers on the test server. The live assistant, nginx, the SMS RAG service, other sites and all shared credentials were untouched, and no shared key was revoked. Source of record: `REPORT.md` §15.1–§15.6.

Baseline unchanged from the previous brief: gpt-5.6-luna at its default temperature, prompt v5 (`ff9ee87141ac1362`), index `kb-pilot-c` (916 chunks, 30 documents), floor 1.15 · margin 0.07 · top_k 10 · 5 excerpts.

---

## 1. What the brief asked for, and what came back

### Item 1 — reconcile the published numbers against the stored runs

Four findings, all recomputed from the saved dumps with no new model calls:

1. **The four suites do not share one pass rule.** Work-order and manual-coverage require **all three** runs; frozen and corrected-claims take the **majority of three**. Earlier reports labelled every suite "all runs required". Both rules are now published side by side.
2. **Three "baseline" cells were never measured on the baseline.** The flags-off column for frozen, corrected and manual coverage came from an older image. They are now marked *not run*, and a proper baseline was measured in item 6.
3. **The work-order drop from 6/8 to 5/8 with routing on is answer variance, not routing.** On all eight work-order cases the five excerpts are byte-identical between the two arms; one run of three worded itself differently and failed. Routing changed no input on that suite.
4. **The frozen failure is case 05 itself.** Routing moved it from "clarification, nothing cited" to "correct answer, six categories listed, page cited in position 3 of 5". Both score zero, so the improvement is invisible in the total.

Also corrected: the manual-coverage loss count was six losses — five run-to-run wording differences plus one selection change — and a seventh item had been mixed in that is a retrieval loss but not a score loss. And the routing suite's 13 checks were being reported as one number although only 13 assert the module while 12 also assert a named source:

| measurement | flags off | routing on | routing + selection |
|---|---|---|---|
| module chosen correctly (13) | 10 | 13 | 13 |
| expected source among the five (12) | 7 | 10 | 12 |

### Item 2 — review all 171 stored answers on their own merits

Method: a pack built from the stored dump plus the captured request bodies, showing for each run the question, the verified manual evidence, the citations the user sees, **every supplied excerpt in full**, and the complete answer. Judged run by run, nothing inherited. Four reviewers, one module group each, then every defect adjudicated by hand.

**A flaw in the first pass, found and corrected.** The first pack truncated excerpts at 700 characters, which made three correct answers look fabricated. The pack was regenerated untruncated and the whole review repeated. The three findings are retracted.

| verdict, per run | of 171 |
|---|---|
| correct | 105 |
| correct paraphrase | 52 |
| honest limitation, evidence genuinely absent | 5 |
| honest limitation although evidence was supplied | 1 |
| partial | 5 |
| wrong (answer built on the wrong module's text) | 3 |

**49 of 57 cases are clean in all three runs.** The six substantive defects, by kind:

- **Procedural mistake (1):** a question about a Positive Observation gets steps that still say "enter the Negative observation", and the page toggle is omitted.
- **Unsupported comparison (1):** asserts two filter sets differ by comparing the dashboard against a different screen, dropping the caveat its sibling runs include.
- **False claims that evidence is missing (4):** the model declines or hedges although the supplied text answers the question — twice on a cross-reference that names the exact operation asked about, twice on a section whose steps were supplied.

**Cross-reference scope was checked case by case.** A "follow the same steps" note licenses only the operation it names: the Certificates note covers adding or viewing an attachment, not the survey workflow. No run widened a reference; the defects are the reverse.

**A correction to the previous brief.** It listed as a limitation that two manual sentences exist in no retrievable chunk. That is wrong. All five disputed sentences are in the index, in exactly the expected chunk. They were not retrieved, or the question went to the wrong module. Three states must be kept apart — absent from the manual, absent from the index, present but not retrieved — and all five are the third.

Two classifications that were open are now settled: the preparation-attachments case is **not** an answer failure (the adjacent excerpts support every required claim), and the dashboard-filters case **is** a retrieval defect (the vessel-side section exists, is indexed at page 9, and was not retrieved).

### Item 3 — a fresh validation set, frozen before any fix

Ten source-backed questions written from the manual text and frozen before testing: five ordinary procedures and conditions, one alternatives case, the broad-versus-named work-order pair, and two module-context cases. Held out of tuning — the selection calibration in item 4 deliberately excludes them.

Corrections applied before first use: the named work-order case now fails an *instruction* to use the wrong method rather than any mention of it; the notification case checks the view and edit actions as well as filtering; the certificate case checks all four documented filters; and every case carries a rubric stating that meaning, conditions and source support decide the verdict, not literal phrase matching.

### Item 4 — fix the demonstrated defects

**Diagnosis first, embeddings only.** For every defective question the expected chunk's position was measured. One cause dominated: across 77 suite questions the rescue made 23 swaps and **22 displaced a nearer chunk**. The four swaps that helped all scored 0.6 to 0.93 per content word and cost at most 0.12 of distance; the harmful ones scored under 0.45 per word or cost more.

**Adopted:** the lexical leader may take the last slot only if it scores at least 0.45 per content word **and** is no more than 0.15 farther than the excerpt it displaces.

| selection variant | expected source among five | swaps | swaps losing nearer evidence |
|---|---|---|---|
| vector only | 69/77 | 0 | 0 |
| unguarded rescue (previous candidate) | 72/77 | 23 | 22 |
| **guarded rescue** | **73/77** | **8** | 8 |

**Not adopted:** two routing "second opinion" variants were implemented and measured. Neither recovers the Audit History case, because the nearest runner-up module is Safety at 1.002 while the correct Audit chunk is at 1.020, and both cost the gains above. The code stays switched off and **that defect is reported as open, not fixed**.

**Prompt v6**, three sentences added to v5 with nothing removed (v5 `ff9ee87141ac1362`, v6 `d372abf3b93cc481`): use the evidence you were given before claiming something is missing; adapt steps to the variant asked about; compare two things only when both are in the excerpts. Replayed against v5 on the identical captured inputs of the six defective runs plus ten controls — 32 calls, about $0.02. v6 improved every defect wording and left both honest-limitation controls honest.

No manual was re-parsed and the index is unchanged.

### Item 5 — correct the judges, validate on stored answers

- **Citation:** the expected manual and page may appear anywhere in the citation list shown to the user, not only first. **Guarded:** this applies only to page-anchored cases, because a name-only match can hit a different document, which would let a filename stand in for support. The top-citation result is still computed and reported.
- **Forbidden phrases:** a phrase inside a negation is not a violation.

Validated by re-scoring eight stored dumps under both judge versions. Old scores preserved, dumps untouched. **270 verdicts changed**: 260 citation, 9 negation, 1 both. The corrected-claims suite is unchanged, which is the check that the name-match hole stayed closed.

### Item 6 — verify the final package against an identified baseline

One image, one index, one model, one key. The arms differ only by two flags and the prompt version.

| suite (all-runs rule) | baseline, flags off, v5 | routing + guarded rescue, v5 | same + prompt v6 |
|---|---|---|---|
| routing probes 13 (deterministic) | 8 | **13** | **13** |
| retrieval 18 | 18 | 18 | 18 |
| frozen 12 ×3 | 11 | **12** | 10 (11 by reading) |
| corrected claims 14 ×3 | 12 | 10 | 12 |
| work orders 8 ×3 | 5 | **7** | **7** |
| fresh validation 10 ×3 | 9 | **10** | **10** |
| manual coverage 57 ×3 | 34 | **35** | 32 |
| **total of 101 cases** | **71** | **74** | **71** |

**Repeatable:** routing 8 → 13, retrieval unchanged, two work-order intents, frozen case 05, one fresh case. **Noise:** everything else that moves is one run of three on a case the other arms pass.

Cost and latency were equal across arms: about **$0.68 per 1,000 questions**, mean latency 3.8 to 4.0 seconds, p95 about 8 seconds, measured with three arms answering concurrently. The whole verification cost about $0.62 for 903 answers.

**Recommendation given to the owner: deploy nothing yet.** If one candidate is promoted, the evidence supports **routing plus guarded rescue on prompt v5** — the only arm improving every deterministic measure with no regression outside the variance band. **Prompt v6 is held**: its rules demonstrably fix the wording defects on the inputs that produced them, but the full suites show no aggregate gain and one real new defect (a crew-export answer offering a forbidden alternative). The proposed way to settle it is a replay of v5 against v6 on all 171 stored inputs, about 342 calls and $0.12, judged by reading.

---

## 2. Open items, stated as open

1. The Audit History review question still routes to Technical. Two fixes measured, neither works.
2. Answer variance dominates the suites at three runs; differences of one to three cases are not evidence.
3. Judge gaps reported, not patched: the attribution phrase list misses "the same procedure as"; the not-covered word list fires on an honest caveat about one sub-item; literal matching still undercounts paraphrases.
4. Two indexed pages are still not retrieved, though the answers are correct from adjacent sections.
5. One real answer defect in the final run: a crew-export answer offers the Crew Database export, which that case forbids as a different sub-module.

---

## 3. What the reviewer is asked to check

1. Is the reconciliation now sound — two pass rules published, baseline cells marked not run, routing and source-presence separated rather than added together?
2. Is the 171-run review adequate evidence, given the first pass had to be retracted for truncated excerpts? Is the per-run record enough to audit a verdict you doubt?
3. Are the six defects classified correctly, in particular the four "false claim that evidence is missing" runs against the cross-reference scope rule?
4. Is the guarded rescue justified by the calibration, or is a threshold on lexical score per content word overfitted to 77 questions?
5. Was refusing to adopt either routing variant the right call, rather than shipping a partial fix for the Audit History case?
6. Is holding prompt v6 correct on this evidence, and is the proposed 171-input replay the right way to settle it?
7. Is judge .5 defensible — specifically, does restricting citation-anywhere to page-anchored cases close the filename-substitution hole you raised?
8. Does the final table support the recommendation, or does the variance band mean no candidate is distinguishable from the baseline yet?

Nothing is deployed. Promotion would also move the live service to this model, prompt and dedicated key, which is a separate decision for the owner.
