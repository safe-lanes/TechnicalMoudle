# Office 'Generate Now' — generate a vessel's due work orders from the office
Applies to: Office
Who can do it (role): Sail Admin only. Any other office role is refused by the server with "Only a Sail Admin may generate work orders directly from the office." [code: server/modules/work-orders/services/workOrderGenerationGate.ts:44,141-147, replit_dev cf5241ad6]
Prerequisites (switches, settings, job/component state):
- The selected vessel's 'office work-order generation' switch must be ON. It is OFF by default for every vessel; a Sail Admin enables it per vessel on the 'Lead Time & Grace Period Settings' screen. With the switch off the server refuses with "Office work-order generation is not enabled for this vessel." [code: server/modules/work-orders/services/workOrderGenerationGate.ts:71-87,150-161, replit_dev cf5241ad6]
- One specific vessel must be selected on the Work Orders screen — the button is disabled for 'All' or 'My' vessels. [code: client/src/pages/pms/WorkOrders.tsx:1492-1493, replit_dev cf5241ad6]
- Only jobs that are due and have no active work order are generated — the same rules as the ship's scan. [code: server/services/jobDueScanner.ts:163-195,334-335, replit_dev cf5241ad6]
Steps:
1. Open the 'Work Orders' sub-sub-module and select the vessel from the 'Vessel' dropdown. [manual: Office PMS Technical manual, June rev, p.28] [screenshot: Office PMS Technical manual, p.28 — callouts "1. Click here to access the 'Work Orders'", "2. Click here to select a vessel"]
2. Click 'Generate Now' in the toolbar of the Work Orders screen (next to 'Planner' and 'Export'). [code: client/src/pages/pms/WorkOrders.tsx:1487-1499, replit_dev cf5241ad6]
3. The server runs the generation sweep for that vessel only and returns; the new work orders appear under the Scheduled / Due / Overdue tabs. [code: client/src/pages/pms/WorkOrders.tsx:425-433, replit_dev cf5241ad6] [code: server/modules/work-orders/routes.ts:89-91, replit_dev cf5241ad6] [manual: Office PMS Technical manual, June rev, p.28]
Exceptions / edge cases:
- The button is shown to Sail Admin, Client Admin and Head of Dept on the office instance, but the server accepts Sail Admin only; the other two roles see a button whose every click is refused. Recorded in CONFLICTS.md (existing standalone note). [code: client/src/pages/pms/WorkOrders.tsx:1487, replit_dev cf5241ad6] [code: server/modules/work-orders/services/workOrderGenerationGate.ts:141-147, replit_dev cf5241ad6]
- On a ship instance this gate always allows generation (the ship's own scan is the normal path). [code: server/modules/work-orders/services/workOrderGenerationGate.ts:120, replit_dev cf5241ad6]
- 'Generate Now' does NOT apply to the per-job 'Generate WO' button on the Components page, which has its own, different condition — see office-generate-wo-per-job.md.
Where the manual differs:
- The June manuals do not mention 'Generate Now', the Sail Admin restriction or the per-vessel switch. Recorded in CONFLICTS.md.
Related procedures: planned-wo-ship-daily-scan.md · office-generate-wo-per-job.md · unplanned-wo.md
Sources:
- Manual: `Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf` (Office, Revision 02, 08 June 2026), p.28 — text layer and screenshot callouts (callout text is present in the PDF text layer; no image transcription was needed).
- Code: Technical repository at `origin/replit_dev` cf5241ad6 — `server/modules/work-orders/services/workOrderGenerationGate.ts`, `server/modules/work-orders/controllers/workOrderController.ts:131-148` (the only caller of the gate), `server/modules/work-orders/routes.ts`, `client/src/pages/pms/WorkOrders.tsx`, `server/services/jobDueScanner.ts`. The seven work-order files were verified byte-identical between the working branch and `origin/replit_dev`; the RUNNING Technical revision (Nilesh's dev/prod deployment, and the Replit phase2 fork) has NOT been verified as identical to cf5241ad6.
- Folder: `D:\manuals\SAIL - User Manuals\Technical module\` (folder dated 09-09-2026).
