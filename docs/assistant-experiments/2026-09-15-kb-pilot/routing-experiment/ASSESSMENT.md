# Candidate assessment — finished on the 204 answers already collected

No new model calls. Everything below is computed or read from the stored responses and the index.
**Nothing deployed. Live and all other sites unchanged.**

**Baseline caveat, stated first:** this compares the candidate against the **experimental F1 arm**
(`kb-pilot-e`, prompt v5, `ROUTE_INTENT=on`, `HYBRID=rescue`), **not** the currently deployed
configuration. Nothing here says what would happen to production behaviour.

---

## 1. Corrections to the last report

### 1.1 Token usage was available and I missed it

My script looked for `total_tokens`; the field is `prompt_tokens` / `completion_tokens`. Recomputed:

| across 102 answers per arm | baseline | candidate | delta |
|---|---:|---:|---:|
| input tokens | 153,396 | 173,025 | **+19,629** |
| output tokens | 26,202 | 26,313 | +111 |

The reviewer's figures reproduce exactly. **273 extra input tokens per affected answer**
(19,629 ÷ 72 affected answers), not the 225 I estimated from character counts.

**Attribution check** (instrument audit, per the new rule): the 10 test questions whose excerpts do
**not** change show an input-token delta of **exactly +0**, so the whole +19,629 is attributable to the
24 affected questions and nothing leaked from elsewhere.

Dollar cost is not stated here — it needs the input/output rates for `gpt-5.6-luna`, which I do not have.

### 1.2 "579 of 579 correct labels" does not mean the answers are right

Accepted. That check tests the module *label* on each citation, nothing more. Two separate things were
therefore measured:

- **93 added citations across the three runs** (31 per complete run set) — the reviewer's count, confirmed.
- **Of those, the answer names the added manual in only 6 answer-instances**: `hist-1` (all 3 runs, the
  intended fix) and `fresh-ctx-conflict-1` (all 3 runs, correctly attributing Technical material while
  declining to present it as Safety). *Limit of that check: it detects whether the answer NAMES the
  manual; it cannot detect content used without attribution. That is what the reading in §2 covers.*

So on **22 of 24** affected questions the added evidence is inert — it is paid for in tokens and not
used. That is the honest cost picture: the change buys one fixed answer and one better-attributed
answer, and pays ~273 input tokens on 24 questions for it.

### 1.3 Text similarity does not prove no regression

Accepted and withdrawn as evidence. Replaced by the case-by-case reading below.

---

## 2. Case-by-case correctness — all 24 affected questions, both arms, 3 runs (144 answers)

Each answer read against the excerpts actually supplied to it. The supplied set is reconstructed from
the offline model, which `verify_instruments.py` confirms matches the live containers on 34 of 34
questions, both arms.

### Supported — 24 of 24

No answer on either arm asserted anything its supplied excerpts do not carry, and **no added
cross-module excerpt contaminated an answer**. The cases where contamination was most plausible:

| case | risk | outcome |
|---|---|---|
| `fresh-technical-1` | Audit *and* Crewing "apply filter" procedures added to a Technical filter question | answer stays Technical; neither intruder used |
| `fresh-ctx-conflict-1` | Technical component-tree page added to a Safety-routed question | says "not covered in the Safety documentation" and attributes the Technical material to Technical, 3/3 |
| `certsurveys-3` | Audit checklist attachment procedure added to a survey-attachment question | every step traced to Technical Cert. & Surveys p.9; the Audit excerpt unused |
| `moc-office-1`, `ra-office-1`, `ra-office-3` | Technical pages added to Safety-routed questions | all answer from Safety |
| `inc-1` | the case the *displacing* variants broke | p.18 "Part K: Office Closeout" retained; answer correct |

### Actual regressions — 0

### Three answers changed for the better

- **`hist-1`** — the target case. Baseline answers from the work-order review procedure in all three
  runs; candidate answers from Audit History §3.3 p.16 and cites it, 3/3.
- **`pmsoffice-5`** — the baseline compares the Office *Dashboard* filter set against the vessel
  *Reports* filter set, which differ in both screen and environment, and presents it as a Dashboard
  comparison. The candidate instead states that the excerpts **do not document** the vessel-side
  Dashboard filters, 3/3. This closes a qualification recorded as open in the earlier citation review.
- **`ra-office-3`** — the supplied Safety manual says verbatim *"The filtering functionality is same
  across… The available filter options vary depending on the selected section."* The candidate carries
  both clauses in 3/3 runs; the baseline omits the second in run 1. More consistent, not different.

### Not reviewed, and why

The other 10 test questions receive **byte-identical excerpts** on both arms, so the candidate is the
same system on the same input; any difference between them is model sampling, not an effect of the
change. They were not read case by case, and that is a limit, not a result.

---

## 3. Unresolved — the Waitlist export question, and it is a corpus defect, not a model one

The reviewer asked whether the manual means "use the same procedure within Waitlist" or actually tells
the user to change lists. **The manual means the former; our own indexing made it say the latter.**

Crewing §1.2.3.3, p.22 (Waitlist), as indexed:

> *"Refer to the 'In—Progress' sub-sub-module for the export process and apply the same steps.*
> *(Cross-reference resolved: the steps for Waitlist › How To Export Crew Details are the same as
> section 1.2.1.5 … under In Progress, page 19. They are:) **Click on the 'In-Progress' sub-sub
> module.** …"*

The source sentence says "apply the same steps". The cross-reference resolver then pasted In-Progress's
steps in verbatim **without rewriting "In-Progress" to "Waitlist"**, so the chunk literally instructs
the user to open the wrong list. Both arms reproduced the supplied text faithfully. The model is not at
fault.

**Scale:** 41 chunks in `kb-pilot-e` carry a resolved cross-reference; **7 of them paste steps that name
a different sub-module than the section they sit in** — Crewing p.21, p.22, p.23 (three crew lists all
pasting In-Progress) and Technical Store p.43, p.44, p.49, p.51.

Not fixed. It belongs to the document-generation step, not to this candidate, and fixing it needs a
re-index.

---

## 4. Where the candidate stands

- Fixes the one wrong module selection in this experiment, at the answer level, 3 runs of 3.
- No regression found in 144 read answers; two answers improved.
- Costs 273 input tokens per affected question, of which 22 of 24 gain nothing.
- Latency unchanged (median 3355 → 3210 ms).
- Citation labels correct, including cross-module — which requires the one-line fix shipped with it.

**Still open and untouched by this work:** the work-order switch contradiction; the two page-level
misses `prep-3` and `sms-office-1`; the unresolved claims from the citation review; the cross-reference
paste defect above; and the non-unique dedup identity `(file, breadcrumb, chunk_index)` (921 chunks,
919 distinct).

**Deployment remains on hold.** The candidate exists only as container `sail-assistant-py-g1` on
127.0.0.1:8036, and the source change is flag-gated with `ASSISTANT_CROSS_MODULE_GAP` defaulting to 0.
