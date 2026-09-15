# Knowledge Base Pilot — Technical Module, Work Orders

**Scope:** Pilot only. Candidate instance only. Live service, retrieval, prompt, parser tier, excerpt count (5) and the 907-chunk set stay untouched.
**Reference:** KNOWLEDGE-BASE-PROPOSAL.md (read it first). This brief narrows it to a pilot.
**Source manuals:** `D:\manuals\SAIL - User Manuals\Technical module\` (June revision, folder dated 09-09-2026). Read the PDFs from there; list the exact file names you used in each procedure's Sources block.
**Builds on:** the code-derived work-order section already on the candidate (R3.2 / §S.7.1) and its test case `wo-generic-01`. Do not write that content a second time — restructure it into the procedure files below and retire the single section once the pilot files supersede it on the candidate.

## Goal

Prove or disprove one claim: if the work-order content is rewritten as reviewed, procedure-level markdown with screenshot instructions placed inline, do the failing work-order cases start passing — with retrieval, prompt and excerpt count exactly as live?

Known failing items this must be measured against: `wo-generic-01` (passes 2 of 3 runs; one run drops a condition), the phrasing "How to create work order in PMS?" (fails 3 of 3; the section ranks 6th, only 5 excerpts shown), and case 09 (attribution sentence missing after the last prompt change).

## Deliverable 1 — Procedure files

One markdown file per procedure under `kb/technical/work-orders/`. The four ways a work order comes into being are four separate files. Do not blend them.

1. `planned-wo-ship-daily-scan.md` — planned work orders generated automatically by the ship's daily job-due scanner. No user action.
2. `office-generate-now.md` — office "Generate Now" button. Per code: Sail Admin AND the vessel's office-generation switch (off by default).
3. `office-generate-wo-per-job.md` — per-job "Generate WO" from the Components page. Per code (latest trace): the vessel switch only, no role check on this path.
4. `unplanned-wo.md` — creating an unplanned work order via +Unplanned.

**Before writing 2 and 3:** your earlier reports contradicted each other on whether the per-job path also requires Sail Admin. Trace both routes to the actual guard and cite file:line in the procedure file. The procedure file states only what the trace shows. If the trace is ambiguous, write `[unverified]` and say why — do not pick one.

Every file uses this structure, in this order, no sections omitted (write "None" if empty):

```
# <Procedure name>
Applies to: Office | Vessel | Both
Who can do it (role):
Prerequisites (switches, settings, job/component state):
Steps:
Exceptions / edge cases:
Where the manual differs:
Related procedures: (link, do not copy)
Sources:
```

Keep each action together with its own conditions. A generic "who can generate work orders" answer must not carry the Sail Admin requirement from Generate Now onto the per-job path.

## Deliverable 2 — Provenance

Mark the origin of every non-trivial statement inline, so it survives into chunk metadata:

- `[manual: <Office|Vessel PMS Technical manual, June rev>, p.N]` — text from the PDF
- `[screenshot: <manual>, p.N]` — read from an image; OCR first, vision model only if OCR is insufficient
- `[code: <path>:<line>, replit_dev cf5241ad6]` — from the Technical repository. Use the seven work-order files already verified byte-identical to `origin/replit_dev` (scanner, generation gate, jobs routes and service, work-order routes, Work Orders page, Components page)
- `[unverified]` — anything not traceable to one of the above

Add a `## Sources` block at the end of each file listing every source used, the manual revision, and the code revision. State in it that the code was verified against `origin/replit_dev` and that the running Technical revision (Nilesh's deployment, and the Replit phase2 fork) has NOT been verified as identical.

## Deliverable 3 — Conflict log

`kb/technical/work-orders/CONFLICTS.md`: every place the manual and the code disagree, one row each — procedure, manual says, code says, file:line. Known entries to include: Generate WO shown as unconditional in the June manuals; automatic ship generation absent from the manuals; the Generate Now button visible to Client Admin and Head of Dept while the server allows Sail Admin only (this is an existing standalone note — link it, do not re-investigate and do not fix).

Do not resolve conflicts by assuming the code is right. The procedure file states the code behaviour, marks it `[code: ...]`, and the "Where the manual differs" section records the disagreement for the domain owner.

## Deliverable 4 — Reviewer checklist

`kb/technical/work-orders/REVIEW.md`: one row per procedure — Reviewer, Date, Checked against PDF (Y/N), Checked screenshots (Y/N), Checked roles/switches (Y/N), Status (Converted / Reviewed / Approved). All rows start as "Converted". Do not set any row to Reviewed or Approved yourself.

## Deliverable 5 — Index and measure

1. On the candidate, index the four pilot files as a separate source set tagged `source=kb-pilot`, alongside the existing Technical chunks. Remove the earlier single code-derived section from the candidate index so the pilot files are the only source of that content. Nothing else in the index changes.
2. Prompt, thresholds, judge and excerpt count (5) exactly as live. Do not touch the prompt — the case 09 question is whether the last prompt change or the index caused the drop, and this run must not mix the two again.
3. Run A (baseline): candidate index without the pilot chunks. Must reproduce 18/18 retrieval, 11/12 answers.
4. Run B (pilot): same, with the pilot chunks. Three runs per case, as the existing three-run standard.
5. Run C (only after B): excerpt count 6, everything else as B. This is Astra's test for the rank-6 phrasing — a single setting change, reported separately.
6. For every work-order question, report: which chunk ranked where in A, B and C; pass/fail per run; whether the pilot chunk was in the excerpts shown to the model.
7. Case 09: judge whether the answer still connects the borrowed steps to the requested workflow. Judge the meaning, not the presence of one sentence. Report the meaning-based result and the frozen-judge result side by side. Do not edit the judge.

## Report format

Short. In this order:

1. Files produced, with how many statements carry each provenance tag.
2. The per-job vs Generate Now guard trace, with file:line, stated definitively or marked unverified.
3. Conflict log summary.
4. Runs A, B, C per work-order question, three runs each; plus the full suite totals for each run.
5. Any work-order question that fails in B with the pilot chunk in the excerpts — flag as a retrieval/answer issue, not a content issue.
6. Anything you guessed. Guesses are not findings.

## Rules

- No deploy, no merge, no changes outside `kb/` and the candidate index.
- Do not edit the frozen suite, the judge, the prompt, thresholds, or ERP business behaviour.
- If a screenshot cannot be read reliably, mark `[screenshot: unreadable, p.N]` rather than inventing content.
- Ask before expanding beyond the four procedures.
