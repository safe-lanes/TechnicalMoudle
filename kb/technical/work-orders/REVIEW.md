# Reviewer checklist — work-orders KB pilot

All rows start as "Converted" (written by the assistant build from the June manuals and the code at `origin/replit_dev` cf5241ad6). A human reviewer sets Reviewed / Approved; the converter must not.

| Procedure file | Reviewer | Date | Checked against PDF (Y/N) | Checked screenshots (Y/N) | Checked roles/switches (Y/N) | Status |
|---|---|---|---|---|---|---|
| planned-wo-ship-daily-scan.md | | | | | | Converted |
| office-generate-now.md | | | | | | Converted |
| office-generate-wo-per-job.md | | | | | | Converted |
| unplanned-wo.md | | | | | | Converted |
| how-work-orders-are-created.md (overview, added 15-Sep) | | | | | | Converted |

Notes for the reviewer:
- Statements tagged `[code: …]` describe behaviour read from the repository, not from the running system; the running Technical revision has not been verified as identical.
- Statements tagged `[screenshot: …]` were taken from the callout text embedded in the PDF text layer, plus the rendered page image for the 'Generate Work Order' pop-up options and the unplanned form layout. No OCR engine was available on the build machine; nothing was transcribed from an unreadable image.
- No `[unverified]` tag remains in any indexed file (owner rule 15-Sep: indexed text carries no unverified claims).

Open items for the reviewer (not in the indexed text):
- unplanned-wo.md — does the running-hours-reading requirement at completion (`server/modules/work-orders/services/workOrderCompletionService.ts:131-141`, RH-based work orders; components marked not RH-driven exempt) apply to the unplanned form's Part B submission in the same way as to a planned work order's completion? Not traced in this pilot.
