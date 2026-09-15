# Create an unplanned work order ('+ Unplanned W.O')
Applies to: Both
Who can do it (role): Any user who can open the Work Orders page. No role or switch check was found on this path. [code: server/modules/work-orders/routes.ts:103, replit_dev cf5241ad6] [code: client/src/pages/pms/WorkOrders.tsx:373,1533, replit_dev cf5241ad6]
Prerequisites (switches, settings, job/component state):
- None — no vessel switch is involved. [code: server/modules/work-orders/routes.ts:103, replit_dev cf5241ad6]
- On the office instance a vessel must be selected from the 'Vessel' dropdown first. [manual: Office PMS Technical manual, June rev, p.29]
Steps:
1. Go to the 'Work Orders' sub-sub-module. [manual: Office PMS Technical manual, June rev, p.29] [screenshot: Office PMS Technical manual, p.29 — callout "1. Click here to access the 'Work Orders'"]
2. Office: select the vessel from the 'Vessel' dropdown. [manual: Office PMS Technical manual, June rev, p.29] [screenshot: Office PMS Technical manual, p.29 — callout "2. Click here to select a vessel"] (The Vessel manual omits this step: on the ship the vessel is fixed.) [manual: Vessel PMS Technical manual, June rev, p.24]
3. Click the '+ Unplanned W.O' button (top right of the Work Orders screen, next to 'Planner' and 'Export'). [manual: Office PMS Technical manual, June rev, p.29] [screenshot: Office PMS Technical manual, p.29 — callout "3. Click here to open an unplanned work order form"]
4. The 'Work Order Form – Unplanned Maintenance' opens. Enter the required job details in Part A and click 'Save' (top right) to store it as a draft. [manual: Office PMS Technical manual, June rev, p.29] [screenshot: Office PMS Technical manual, p.29 — callout "Click the Save button to save it as a draft."]
5. Complete Part B (Work Completion Record: work carried out, running hours, spare parts consumed) and click 'Submit Work Order' at the bottom of the form to create the unplanned work order. [manual: Office PMS Technical manual, June rev, p.29] [screenshot: Office PMS Technical manual, p.29 — Part B sections 'B3. Running Hours', 'B4. Spare Parts Consumed'; callout "After filling the form, click here to create an unplanned work order."]
6. The work order appears under the 'Unplanned' tab; its number is <VESSELCODE>-UWO-<COMPONENTCODE>-<YEAR>-<NNN>. [manual: Office PMS Technical manual, June rev, p.28] [code: server/utils/workOrderNumbering.ts:10-11, replit_dev cf5241ad6]
Exceptions / edge cases:
- Running-hours-based work: a running-hours reading is required at completion for RH-based work orders (components marked not RH-driven are exempt). [code: server/modules/work-orders/services/workOrderCompletionService.ts:131-141, replit_dev cf5241ad6] [unverified] whether this check applies to the unplanned form's Part B submission in the same way as to a planned work order's completion — not traced in this pilot.
Where the manual differs:
- None found for the steps themselves. The Vessel manual has no 'select vessel' step (ship instance is single-vessel). [manual: Vessel PMS Technical manual, June rev, p.24]
Related procedures: planned-wo-ship-daily-scan.md · office-generate-now.md · office-generate-wo-per-job.md
Sources:
- Manual: `Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf` (Office, Revision 02, 08 June 2026), p.28, p.29 — text layer and screenshot callouts (callout text present in the PDF text layer; the form layout was read from the rendered page image).
- Manual: `PMS User Manual_Vessel Specific_R3_08.07.2026.pdf` (Vessel, Revision 03, 08 July 2026), p.24.
- Code: Technical repository at `origin/replit_dev` cf5241ad6 — `server/modules/work-orders/routes.ts`, `client/src/pages/pms/WorkOrders.tsx`, `server/utils/workOrderNumbering.ts`, `server/modules/work-orders/services/workOrderCompletionService.ts` (the last two are outside the seven verified files; cited as read on the working branch). The seven work-order files were verified byte-identical between the working branch and `origin/replit_dev`; the RUNNING Technical revision (Nilesh's dev/prod deployment, and the Replit phase2 fork) has NOT been verified as identical to cf5241ad6.
- Folder: `D:\manuals\SAIL - User Manuals\Technical module\` (folder dated 09-09-2026).
