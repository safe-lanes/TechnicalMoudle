# 'Generate WO' for one job — from the Components page
Applies to: Both
Who can do it (role): Any user who can open the Components page. There is no role check on this path: the route has no role guard, the controller has no role check, and the service checks only the vessel switch (office) or nothing (ship). It is NOT limited to Sail Admin. [code: server/modules/jobs/routes.ts:11,39-40, replit_dev cf5241ad6] [code: server/modules/jobs/controllers/jobController.ts:153, replit_dev cf5241ad6] [code: server/modules/jobs/services/jobService.ts:570-587, replit_dev cf5241ad6]
Prerequisites (switches, settings, job/component state):
- On the OFFICE instance: the job's vessel must have its 'office work-order generation' switch ON (off by default; enabled per vessel by a Sail Admin on the 'Lead Time & Grace Period Settings' screen). With the switch off the request is refused with "Office work-order generation is not enabled for this vessel." [code: server/modules/jobs/services/jobService.ts:576-583, replit_dev cf5241ad6] [code: server/modules/work-orders/services/workOrderGenerationGate.ts:71-87, replit_dev cf5241ad6]
- On the SHIP instance: no switch and no role — always available. [code: server/modules/jobs/services/jobService.ts:576-577, replit_dev cf5241ad6]
- The job must be active. [code: server/modules/jobs/services/jobService.ts:570, replit_dev cf5241ad6]
- The job must not already have an active work order. [manual: Office PMS Technical manual, June rev, p.18] [manual: Vessel PMS Technical manual, June rev, p.16]
Steps:
1. Open 'Components', select the vessel, and open the component in the component tree. [screenshot: Office PMS Technical manual, p.18 — Components screen with the tree on the left and the component record on the right]
2. In Part C ('C. Jobs') the component's jobs are listed with Task Type, Frequency, Last Done Date and Next Due Date. [manual: Office PMS Technical manual, June rev, p.18] [screenshot: Office PMS Technical manual, p.18 — callout "1. Here, the user can view all associated jobs and their details."]
3. Click 'Generate WO' in the Actions column of the job's row. [manual: Office PMS Technical manual, June rev, p.18] [screenshot: Office PMS Technical manual, p.18 — callout "2. Click here to initiate a job for the chosen component."] [code: client/src/pages/pms/Components.tsx:1016-1018, replit_dev cf5241ad6]
4. In the 'Generate Work Order' pop-up choose the reason: 'Planning - Scheduled ahead of time', 'Breakdown - Emergency repair needed' or 'Other - Custom reason'. [screenshot: Office PMS Technical manual, p.18 — pop-up options, callout "From here, the user can choose a reason to create the Work Order."] [code: client/src/pages/pms/Components.tsx:915-920,965-966, replit_dev cf5241ad6]
5. The work order is generated and appears on the Work Orders screen. [manual: Office PMS Technical manual, June rev, p.18]
Exceptions / edge cases:
- Duplicate: if the job already has an active work order, the system refuses to generate another. [manual: Office PMS Technical manual, June rev, p.18] [manual: Vessel PMS Technical manual, June rev, p.16]
- Inactive job: refused with "Cannot generate work orders for an inactive job". [code: server/modules/jobs/services/jobService.ts:570, replit_dev cf5241ad6]
- The Sail Admin requirement of the office 'Generate Now' button does NOT apply here; the two buttons use different server checks. See office-generate-now.md.
Where the manual differs:
- The June manuals present 'Generate WO' as unconditional. On the office instance the vessel switch must be on. Recorded in CONFLICTS.md.
Related procedures: planned-wo-ship-daily-scan.md · office-generate-now.md · unplanned-wo.md
Sources:
- Manual: `Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf` (Office, Revision 02, 08 June 2026), p.18 — text layer and screenshot callouts (callout text present in the PDF text layer; the pop-up option labels were read from the rendered page image because the pop-up is part of the screenshot).
- Manual: `PMS User Manual_Vessel Specific_R3_08.07.2026.pdf` (Vessel, Revision 03, 08 July 2026), p.16 — same procedure, same wording.
- Code: Technical repository at `origin/replit_dev` cf5241ad6 — `server/modules/jobs/routes.ts`, `server/modules/jobs/controllers/jobController.ts`, `server/modules/jobs/services/jobService.ts`, `server/modules/work-orders/services/workOrderGenerationGate.ts`, `client/src/pages/pms/Components.tsx`. Trace (definitive): route → controller → service → `jobDueScanner.generateWorkOrderForJob` (no gate); the Sail-Admin gate `evaluateDirectGeneration` has exactly one caller, `workOrderController.ts:133` ('Generate Now'). The seven work-order files were verified byte-identical between the working branch and `origin/replit_dev`; the RUNNING Technical revision (Nilesh's dev/prod deployment, and the Replit phase2 fork) has NOT been verified as identical to cf5241ad6.
- Folder: `D:\manuals\SAIL - User Manuals\Technical module\` (folder dated 09-09-2026).
