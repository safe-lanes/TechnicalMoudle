# Cross-reference repair — second comparison, after the reviewer's corrections

22-Sep-2026. **Nothing deployed. Live, nginx, SMS RAG and every other running service untouched.**
`kb-pilot-e` untouched. Candidate containers remain isolated on 127.0.0.1 only.

## 1. What the reviewer found, and what I did about each

| reviewer finding | verified? | action |
|---|---|---|
| Baseline Surveys answers say "Go to the **Certificates** sub-submodule" but scored correct | yes — all 3 runs; bold markers broke the match | judge now normalises Markdown/typography before matching; pinned in its self-test. **6 published verdicts flipped, all baseline, all judge errors** (3 Surveys, 3 Stores-export "Open the **Spares**…"). Baseline is **6 / 0 / 15**, not 11 / 1 / 9. |
| "Stores has only Search and Stock" contradicted by the code block I shipped | yes — that block is the **Location** view (`stores-loc-*`) and includes **All Categories** | facts rewritten **per view**: Inventory and Location each have Search, All Categories, Stock; History has a search box only; one component serves all four tabs and both environments; Criticality/Rotation still 0 occurrences |
| Surveys: check editable fields, not just the screen name | yes — Surveys edits **Survey Date, Due Date, 1st/2nd Range Date, Postponed**; Certificates' editable set shares no field | new rule 2b replaces a quoted field the destination lacks ("Issue Date") and reports it; editable list stated |
| Provenance: "The manual notes…" was my note, not the manual's | yes — 3 of 21 repaired answers | note now labelled "written at index time by the cross-reference resolver, NOT a statement from the manual"; judge flags PROVENANCE separately |
| "95 reused / 6 new" was the single-document probe, not the build | yes | reconciled below |
| Enforce cache-only; fix dry-run; reconcile charges | done / done / partly | `--cache-only` aborts with `CacheMiss` (proven with `--network none`); dry-run now reads the parse store; reconciliation limits below |
| Test the adapted procedure as the actionable guidance, quote as audit copy | done | `XREF_LAYOUT=adapted-primary` → index `kb-xref-b`, third arm |

## 2. Reconciliation of the builds and the unplanned charges

- **First isolated build (`kb-xref-a`, 967 chunks):** log-summed 770 vectors reused + 96 newly
  embedded across 24 documents (866), plus the single-document probe's 95 + 6 (101) = **967**, the
  index count. 0 LlamaParse uploads in either.
- **Second build (`kb-xref-b`, 980 chunks, `--cache-only`, adapted-primary layout):** **867 reused +
  113 new = 980**, 0 uploads, 0 cache misses — a complete reconciliation from one log.
- **The aborted `--dry-run`** (the cause: `index_documents.py:328` set `conn = None` under dry-run, so
  the parse store was never read): roughly **12–16 agentic-tier LlamaParse jobs, between about
  05:00 and 05:25 UTC on 22-Sep-2026.** I cannot reconcile them from logs: the container was removed
  on stop, the docker journal is not readable to this account, and LlamaCloud's job-history endpoint
  returns **HTTP 410**. **The charge must be read from the LlamaCloud usage page.** The parse store
  still holds 64 rows, unchanged, so nothing new was written.

## 3. Result — 7 frozen cases × 3 arms × 3 runs = 63 answers, 0 errors

Arms differ only in the documents: same image, model `gpt-5.6-luna`, prompt v5, retrieval settings.

```
case                       baseline            repaired_a (quote after)   repaired_b (audit copy)
waitlist-export            inc   inc   inc     cor   cor   cor            cor   inc*  cor
monthly-test-create        cor   cor   cor     cor   cor   cor            cor   cor   cor
appraisals-filter          inc   inc   inc     lim   lim   lim            lim   lim   lim
stores-export              inc   inc   inc     cor   cor   cor            cor   cor   cor
stores-filter              inc   inc   inc     cor   cor   cor            cor   cor   cor
surveys-edit               inc   inc   inc     cor   cor   cor            cor   cor   cor
audit-history-regression   cor   cor   cor     cor   cor   cor            cor   cor   cor

baseline     6 correct   0 limited  15 incorrect
repaired_a  18 correct   3 limited   0 incorrect
repaired_b  17 correct   3 limited   1 incorrect*
```

**\* the one `repaired_b` miss is not a wrong-screen instruction.** Its three steps say Waitlist. The
flagged sentence is *"The manual notes that the Waitlist steps are an adaptation of the In Progress
procedure"* — the **provenance** defect, surviving the explicit "NOT a statement from the manual"
label. I have left the mechanical verdict rather than loosen the judge a third time.

### Per the requested split

- **Correct procedure with citations** — Waitlist export, Monthly test, Stores export, Stores filter,
  Surveys editing: 3/3 on both repaired arms (Waitlist 2/3 on b, see above). Audit History regression
  holds 3/3 on all arms.
- **Honest limitation** — Appraisals filter 3/3 on both repaired arms: the Promotion field list is
  dropped; capped at *limited* before the run. The baseline offered "Promotion Rank" 3/3.
- **Wrong instruction / contradiction** — none on either repaired arm this run. Yesterday's
  `stores-filter` run 3 contradiction (Criticality/Rotation offered for Vessel Stores, then denied)
  did **not** recur in 6 further runs; it was real, and non-determinism means "not observed in 6" is
  the honest claim, not "fixed".
- **Provenance** (false statement about the source, reported separately): repaired_a **3/21**,
  repaired_b **1/21**, baseline 0.

### The waitlist run-2 sentence from yesterday's run, assessed on meaning

*"Other supported export options are the In-Progress procedure and Crew Database…"* — the steps above
it are correct and say Waitlist. The sentence offers "the In-Progress procedure" as another export
option **in answer to a Waitlist question**, which a reader could take as a second way to export the
same Waitlist record. It is misleading, not a wrong-screen instruction; I would class it as a minor
answer defect rather than a repair failure.

## 4. Cost per answer

| arm | prompt tokens / answer | latency median | excerpts / answer |
|---|---:|---:|---:|
| baseline | 1,682 | 4,068 ms | 5.14 |
| repaired_a | 1,725 (+43) | 4,876 ms | 5.00 |
| repaired_b | 1,763 (+81) | 4,771 ms | 5.00 |

## 5. What is established, and what is not

- On these 7 cases the repair removes the wrong-screen and wrong-field instructions the baseline
  gives 15 times in 21, on both layouts.
- The audit-copy layout (`repaired_b`) is **not measurably better** than quote-after (`repaired_a`)
  here; it reduced provenance errors 3 → 1 in one run of 21 each, which is within noise.
- Provenance misattribution persists at low rate even when the note says it is not the manual's.
  That is a model behaviour the document text alone does not fix.
- Appraisals stays *limited* until the Crewing frontend can be checked — it is in no repository here.
- 7 questions, 3 runs, one corpus snapshot; the same case can differ across runs on every arm.
- One cosmetic defect in the repaired text: rule 2b renders *"Click the 'required editable' cell"*;
  it should read *"the required editable cell (Survey Date, Due Date, …)"*. Left as tested, noted for
  the next rebuild.
