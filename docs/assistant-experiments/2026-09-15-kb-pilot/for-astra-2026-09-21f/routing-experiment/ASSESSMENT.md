# Candidate assessment — corrected after the reviewer's fourth pass

No new model calls at any point. The 204 stored answers were re-scored and **re-read in full**.
**Nothing deployed. Live and all other sites unchanged.**

**Baseline caveat, first:** this compares the candidate against the **experimental F1 arm**
(`kb-pilot-e`, prompt v5, `ROUTE_INTENT=on`, `HYBRID=rescue`), **not** the deployed configuration.

**Reconstruction status:** the reviewer independently matched the ordered document names, sections and
displayed PDF pages across all 204 responses, which corroborates the reconstruction of what each answer
was given. It is still **not a capture of the actual model request** — that remains an assumption, and
the outbound capture file was not written because the container user cannot write the mounted volume.

---

## 1. Four corrections, all against my own reporting

### 1.1 The cross-reference defect is larger than I said — 13, not 7

My first count used a single regex for one phrasing (`Click on the X sub-sub module`). The reviewer
found an eighth case it could not see: Technical p.10 §1.1.4.4 begins **"Go to the 'Certificates'
sub-sub module"**. Rather than patch the phrasing I audited **all 41** resolved cross-references with a
pattern that carries a **self-test on cases whose answer I already knew** — and that self-test
immediately caught a second bug in my own tool: the manuals use curly quotes, which my pattern did not
accept, so an intermediate version reported **4**. The audited figure is **13**.

| | count | pattern |
|---|---|---|
| Crewing — a crew list told to open **In-Progress** | 6 | p.21 ×2 (Recruited), p.22 ×2 (Waitlist), p.23 ×2 (Rejected), on *Edit/Delete* and *Export* |
| Technical — Stores told to open **Spares** | 6 | p.43, p.44 ×2, p.49, p.51 ×2 |
| Technical — Surveys told to open **Certificates** | 1 | p.10 §1.1.4.4 *How To Edit A Surveys* |

**These are not all defects, and must not be fixed by a global rename.** The reviewer's caution is the
right one and I cannot resolve it from the documents:

- The **Crewing six** look clearly wrong: Waitlist, Recruited and Rejected are sibling crew lists, and
  the source sentence says "apply the same steps", so sending the user to In-Progress changes the list
  they are working on.
- The **Stores → Spares six** may be genuine. Stores inventory may really be maintained from the Spares
  screen. **This is a product question for Jeevan, not something to infer from the manual.**
- **Surveys → Certificates** is the same open question.

The other 28 paste steps that begin at a button or a field and carry no navigation, so they are
unaffected.

### 1.2 The Risk Assessment "improvement" was wrong — retracted

I claimed the candidate carried a qualification in 3/3 runs that the baseline managed in 2/3. It is
in **all three** baseline runs. Baseline run 1 ends: *"…although the available filter options vary by
section."* I had read only the first 175 characters of it. **The claimed gain is removed.**

That error also invalidated the method behind my previous "24/24": most of that reading was done on
truncated text. **All 24 have now been re-read in full**, and §2 replaces the earlier verdict.

### 1.3 "Unused on 22 questions" — corrected to "not explicitly cited"

Accepted. Not naming a manual does not prove the model ignored its text. The measurement is: of the
**93 added citations across three runs (31 per complete set)**, the answer **explicitly cites** the
added manual in **6 answer-instances** (`hist-1` ×3, `fresh-ctx-conflict-1` ×3). Whether the other
added excerpts influenced wording silently is **not established either way**.

### 1.4 "24/24 supported on both arms" — wrong, and the standard was too weak

Accepted. Support must mean *evidence for the question actually asked*, not words present somewhere in
the excerpts. On that standard the two arms are not equal, and saying they were contradicted my own
findings:

| | supported, question actually asked |
|---|---|
| **candidate** | **24 of 24** |
| **baseline** | **22 of 24** — `hist-1` answers the wrong feature in 3/3 runs (work-order review, not inspection history); `pmsoffice-5` compares the Office **Dashboard** against the vessel **Reports** screen and concludes "they are not the same set" in runs 1 and 2 |

---

## 2. Case-by-case reading — all 24 affected questions, full text

### Candidate: 24 of 24 supported, 0 regressions

No candidate answer asserts anything its supplied excerpts do not carry, and **no added cross-module
excerpt contaminated an answer**, including where it was most likely:

| case | risk | outcome |
|---|---|---|
| `fresh-technical-1` | Audit *and* Crewing "apply filter" procedures added to a Technical filter question | answers from Technical Cert. & Surveys §1.1.3.2 only |
| `fresh-ctx-conflict-1` | Technical component-tree page added to a Safety-routed question | "not covered in the Safety documentation", Technical material attributed to Technical, 3/3 |
| `certsurveys-3` | Audit checklist attachment steps added to a survey-attachment question | every step traced to Technical Cert. & Surveys p.9 |
| `inc-1` | the case the *displacing* variants broke | p.18 "Part K: Office Closeout" retained, answer correct |

Several candidate answers are shorter than the baseline's (`answers/5` omits the add-hazards procedure,
`master-review-1` omits which icon is which). In each case the omitted material was not what the
question asked for. I am **not** calling these improvements or regressions.

### The one remaining difference, stated weakly on purpose

On `pmsoffice-5` the candidate states the limit — *"the excerpts do not document the PMS Dashboard
filters on the vessel side"* — in **3/3** runs; the baseline does so in **1/3** (run 3), and makes the
cross-screen comparison in runs 1 and 2. This closes a qualification left open in the earlier citation
review. **It is one question with three runs per arm, and there is no causal link to the change — the
excerpt the candidate gained here is an unrelated Crewing filter page. It may be sampling.** Not
claimed as a benefit of the candidate.

### Not reviewed

The other 10 test questions receive **byte-identical excerpts** on both arms, so the candidate is the
same system on the same input. Not read; stated as a limit, not a result.

---

## 3. Cost

| across 102 answers per arm | baseline | candidate | delta |
|---|---:|---:|---:|
| input tokens | 153,396 | 173,025 | **+19,629** |
| output tokens | 26,202 | 26,313 | +111 |

**273 extra input tokens per affected answer.** Attribution checked: the 10 questions whose excerpts do
not change show an input delta of **exactly +0**. Latency median 3355 → 3210 ms. Dollar cost not
stated — I do not have the rates for `gpt-5.6-luna`.

---

## 4. Where this leaves the candidate

Keep it. It fixes the one wrong module selection at answer level in 3/3 runs, removes no evidence,
introduces no regression across 24 questions read in full, and labels cross-module citations correctly
— which requires the one-line `citations_of` fix shipped with it.

**Next bounded task, per the recommendation: the cross-reference repair, on an isolated index.**
Preserve the original source wording and citations; distinguish reused steps from destination-specific
navigation (the Stores/Spares and Surveys/Certificates cases need Jeevan's answer before any edit);
re-index to a separate set; and test the affected procedures.

**Still open and untouched:** the work-order switch contradiction; page-level misses `prep-3` and
`sms-office-1`; the unresolved citation-review claims; the non-unique dedup identity
`(file, breadcrumb, chunk_index)` (921 chunks, 919 tuples).

**Deployment on hold.** The candidate exists only as container `sail-assistant-py-g1` on
127.0.0.1:8036; `ASSISTANT_CROSS_MODULE_GAP` defaults to 0.
