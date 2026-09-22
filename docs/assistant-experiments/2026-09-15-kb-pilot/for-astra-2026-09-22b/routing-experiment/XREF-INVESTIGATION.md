# Cross-reference investigation — all 41 reviewed for meaning, root cause located

22-Sep-2026. **No model calls. No re-index. Nothing deployed. Live, nginx, SMS RAG and every other
site untouched.** Code tracing and document reading only.

---

## 1. Two reporting corrections, applied first

- **Coverage.** The assessment opened with "204 answers re-read" while its scope said 144 reviewed.
  Corrected to the actual figure everywhere: **all 204 re-scored, 144 read in full** (the 24 affected
  questions × 2 arms × 3 runs), **60 not read** (the 10 questions whose excerpts are byte-identical on
  both arms).
- **Stores/Spares.** `xref_audit.py` asserted in its own comments and output that Stores inventory *is*
  maintained from Spares, while the report called it unresolved. The assertion is removed. It is now
  resolved by evidence instead — see §2.

## 2. The two open product questions are answered by the code — nothing to ask Jeevan

Astra's instruction was to check the manuals and the code first and ask only what remains. Nothing
remains on these two.

| question | evidence | answer |
|---|---|---|
| Is Stores inventory maintained from the **Spares** screen? | `TechnicalModule.tsx` renders `<Stores />` and `<Spares />` as **separate** components. `stores/Stores.tsx` has its own filter set and its own export — `stores_<tab>_inventory_*.xlsx` and `stores_<tab>_history_*.xlsx` — with its own Export button. | **No.** Stores is its own screen. Sending the reader to Spares is wrong, not a genuine screen switch. |
| Are Surveys edited/exported from the **Certificates** screen? | `cert-surveys/SurveysPage.tsx` edits in the grid (`canEditSurvey`, `CellEditingStoppedEvent`, optimistic `lastEdit` refresh) and has its own `handleExportPdf` / `handleExportCsv` / `handleExportExcel`. The file contains **no reference to Certificates**. | **No.** Surveys edits and exports in place. |

A third case resolved the same way, in the opposite direction:

| Condition of Class (CoC) | `defects/DefectsCoC.tsx` is its own page with its own `handleExportPdf`; CoC records are created through the **shared** `DefectFormWizard` with `is_coc` set. | The pasted **steps genuinely transfer** — a CoC record *is* a defect record. Only the captions ("Defects Log interface") are wrong. |

## 3. Root cause — one line

`central-assistant-py/indexer/xrefs.py:225`

```python
inserts[(s.page, s.end)] = (f"\n\n(Cross-reference resolved: the steps for … "
                            f"are the same as {src}{via}. They are:)\n{target.body}\n")
```

`target.body` is pasted **verbatim**. The framing sentence is careful and accurate, but nothing adapts
the body's screen names, record types, field lists or figure captions to the section it now sits in.
Every defect below is that one line.

## 4. All 41 reviewed for meaning — not 13, and the other 28 were not safe

41 entries, **27 distinct pasted bodies, every one read** (the 41 share bodies; identical text was read
once and the verdict applied to each entry). Classes, and an entry can carry more than one:

| | class | count |
|---|---|---:|
| **A** | the pasted step tells the reader to open the **source sub-module** | **13** |
| **B** | the instruction text names the source's **record type or field list** | **13** |
| **C** | only the **screenshot caption** names the source screen; the steps transfer | **37** |
| **D** | **clean** — no source-specific wording | **4** |

**37 of 41 carry source-specific wording somewhere. Only 4 are clean** (`crewing` p.21/22/23 *Apply
Filter*, whose candidate-list filters are common to all four lists, and `technical` p.11, which is a
self-reference to the same sub-module on another page).

The reviewer's four examples are confirmed, and reading turned up two further B-class patterns he had
not listed:

- **Crew Promotion filters** pasted into Appraisals, Annual, Periodic, Monthly, Post Incident and
  Others — the instruction says *"refine **crew promotion** records by Name, **Promotion Rank**, Vessel,
  Vessel Type, Nationality, Criteria, Status"*. Both the record type **and the whole field list** belong
  to a different screen. Six entries.
- **Post Incident create** pasted into Others — *"enter the required **incident** details … in the
  **Post Incident Test** form"*.

Confirmed from the reviewer's list: Periodic/Monthly/Summary alcohol tests carrying *"create new
**annual** drug and alcohol record"* (3 entries), and Export Surveys carrying *"download the displayed
**certificate** records"*.

`xref_verdicts.py` prints every group with its reason; `xref-verdicts.json` is the machine-readable form.

## 5. Proposed repair — not applied, and deliberately not a rewrite

Astra's constraints are preserve the original wording and citations, identify adaptations clearly, and
no global name replacement. Rewriting the source's nouns would violate the first: the quoted text would
no longer be what the manual says, and a citation to it would be false.

So the proposal **frames** rather than edits:

1. The resolved block states the destination explicitly and warns that the quoted steps use the source
   screen's names and captions — one sentence, generated, clearly ours.
2. For the **13 class-A** entries the navigation step is the only instruction that is actively wrong
   where it sits. Add a generated adaptation line immediately before the quote naming the destination
   screen to start from. The quoted step stays, unaltered, beneath it.
3. Nothing in `target.body` is edited. Citations continue to point at the real source section and page.

Sketch for `technical` p.44 *How To Export Store Items*:

> *(Cross-reference resolved: the steps for Stores › How To Export Store Items are the same as section
> 1.1.7.7 'How To Export Spares Records' under Spares, page 41.* **Apply them in Stores — the steps are
> quoted verbatim from the Spares section, so the screen names and figure captions in them say Spares.***
> *They are:)* …quoted body unchanged…

**Open for the owner, not for me to decide:** whether that framing sentence is acceptable in the
published knowledge base, and whether class C (caption-only) is worth touching at all, given the steps
transfer and only the figure description is off.

## 6. What happens next, once the framing is agreed

1. Change `xrefs.py` (the one paste site) and regenerate the affected documents.
2. **Re-index to a separate index set** — this writes new rows under a new `index_set` and costs
   embedding calls; it does not touch `kb-pilot-e` or any running container.
3. Test the corrected procedures against the **unchanged** candidate — same model, prompt v5 and
   retrieval settings — so the only variable is the document text.

None of that has started. The retrieval candidate is unchanged and still isolated in
`sail-assistant-py-g1` on 127.0.0.1:8036, with `ASSISTANT_CROSS_MODULE_GAP` defaulting to 0.
