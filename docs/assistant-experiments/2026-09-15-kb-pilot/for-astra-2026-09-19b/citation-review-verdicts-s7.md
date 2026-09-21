# Completed citation review — does the supplied text support each answer's claims?

Requested by the reviewer, 19-Sep. Method and raw data: `claim_review.py` → `claim-review-s7.txt`. Stored answers
and captured model inputs only; **no model calls**. This is the review the earlier `citation-review-pack-s7.txt`
did not deliver — that file was the pre-fix diagnostic that exposed the header-parser bug, and it is kept only
for that purpose.

## Method

Every stored answer is split into claims (steps, bullets, sentences, Source block removed) and each claim is
classified:

| class | treatment |
|---|---|
| lead-in (`ends in ':'`, or under five words) | not a claim — the content is in the list below it, scored separately |
| navigational (`Open…`, `Click…` with no condition) | reported, not scored for support |
| source-commentary (a statement *about* the sources) | reported separately, not scored for support |
| **substantive** (conditions, rules, permissions, outcomes) | **scored**: coverage = the claim's content words found in the single best-matching supplied excerpt |

Coverage thresholds — supported ≥ 0.80, partial 0.50–0.79, below 0.50 flagged. **The thresholds route attention;
they are not the verdict.** Every flagged claim was then read against the supplied text, and the verdict below is
that reading.

## Totals

| | corrected arm F1 | pre-change arm F0 |
|---|---|---|
| substantive claims scored | 1,245 | 1,235 |
| supported by one excerpt (≥ 0.80) | 950 | 926 |
| partial (0.50–0.79) | 264 | 280 |
| flagged for reading (< 0.50) | **31** | **29** |
| source-commentary (reported, not scored) | 183 | 166 |
| navigational | 303 | 319 |

## Verdicts on all 31 flagged claims (F1)

### A. Supported — the metric under-scored them; the text is there verbatim (8 claims)

Each was checked by searching the supplied excerpts for the specific fact:

| claim | found in the supplied text |
|---|---|
| `generated/1 r1` "the system generates a code such as **JOB-XXXXXXX** during import" | "A blank Job Code is accepted and a code is generated on import **(JOB-XXXXXXX)**" |
| `manuals/prep-3 r2, r3` "combined size … at or below **20 MB**" | "the combined size of the file(s) selected in a single upload should **not exceed 20 MB**" |
| `manuals/certsurveys-3 r2` "each attachment must be **5 MB** or smaller" | "maximum file size of **5 MB per attachment**. Files larger than 5 MB … cannot be uploaded" |
| `manuals/sms-office-3 r3` "the document reference shown is **Doc 4.2.03**" | a red-boxed "**Doc 4.2.03**" link |
| `answers/3 r3` "saving or submitting is required to generate the request number" | "**Save or Submittion is required for generating the Request no.**" |
| `generated/11 r3` "auto-sync, when enabled on the ship…" | "**Auto-sync runs on the ship when enabled** in the ship's Auto-Sync Settings" |
| `generated/13 r2` "reconciled by date, latest date wins, same-date tie to the ship" | "reconciled by reading date — **the latest date wins; a same-date tie goes to the ship**" |
| `manuals/crewing-2 r2` "it opens the All view by default" | "Click the 'Promotions' sub-module to open the **'All' sub-submodule by default**" |

These are the claims a reader would most want checked — specific numbers, code formats, identifiers — and all
eight are exact. The low coverage came from filler words, not from missing facts.

### B. Cross-excerpt synthesis — not scorable against a single excerpt (20 claims)

"This applies to both Ship and Office", "the sets are different: the Dashboard uses Vessel, Scope and
Criticality, while the vessel-side Reports screen uses Search, Period and All Departments", "it is not a
completely separate procedure for each section", "an Office MoC does not by itself determine the destination",
"these are separate from automatic planned-work-order creation", and similar.

Cases: `answers/10`, `answers/11`, `manuals/pmsoffice-2` (×4), `pmsoffice-4` (×3), `pmsoffice-5` (×4),
`ra-office-3` (×3), `moc-office-2`, `safety-meeting-1`, `crewing-2 r3`, `wo/wo-generic-02 r2`.

Checked: in every case the components of the comparison are present across **two or more** supplied excerpts —
e.g. `pmsoffice-2` was given both the Vessel-manual and the Office-manual sections of the same procedure;
`pmsoffice-5` was given the Dashboard filter section and the Reports filter section. A single-excerpt coverage
score cannot represent this by construction. These are legitimate syntheses of supplied material.

**Limit, stated:** this verdict says the comparison's *components* were supplied. It does not verify that every
comparison is logically correct. Verifying that needs a claim-by-claim entailment check that does not exist.

### C. UNSUPPORTED — 3 claims, all the same case, all one root cause

| run | claim | why it is unsupported |
|---|---|---|
| `manuals/hist-1` r1 | "**Only** the Office / Sail Admin is allowed to add comments in the Review section." | |
| `manuals/hist-1` r2 | "The **office** is allowed to add comments in the Review section." | |
| `manuals/hist-1` r3 | "The office (Office/Sail Admin) is allowed to add comments in the Review section." | |

The question is about the **Review section of an inspection history record** (Audit module). The expected source
is `Audit - History Manual R1 p16`: "The Review section is intended for office users only."

That document **was never supplied**. Because of the known Audit History routing defect the question was routed
to Technical, and the three supplied documents were the PMS Office manual, the Ship-Side notes and the Sync
notes. The model answered from the PMS **work-order** review section — a different feature that also has a
"Reviewer Comments" field — and converted a document audience label ("Audience: Office / Sail Admin") into a
permission rule. The supplied text contains no statement that only the office may comment.

The answers happen to be **correct by coincidence** (office-only is also true of the Audit History Review
section), which is the part worth noting: the routing defect does not merely fail to retrieve — it can produce a
confidently worded permission claim sourced from the wrong feature. All three runs already **fail** the suite on
the citation check, so no score changes; what changes is the characterisation of the risk.

## What this review does and does not establish

- It establishes that, of 1,245 substantive claims on the corrected arm, **three are unsupported by the text
  supplied for the question asked**, and all three trace to one open defect.
- It does **not** convert the citation checks from provisional to verified in general. 264 partial claims were
  not individually read; the sampling rule was "read everything below 0.50", not "read everything". A full
  entailment check per claim does not exist and was not built.
- The same review on the pre-change arm F0 flags 29 claims, with the same shape (the `hist-1` claims appear there
  too — the routing defect is not affected by the document change).
