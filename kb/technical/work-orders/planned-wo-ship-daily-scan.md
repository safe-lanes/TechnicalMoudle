# Planned work orders — generated automatically by the ship's daily job-due scan
Applies to: Vessel
Who can do it (role): None — no user action. Planned (scheduled) work orders are created by the ship system itself. [code: server/services/jobDueScanner.ts:163-195, replit_dev cf5241ad6]
Prerequisites (switches, settings, job/component state):
- The instance must be a ship instance; the scan does not run on the office (shore) instance. [code: server/services/jobDueScanner.ts:195, replit_dev cf5241ad6]
- The job must be active and attached to a component, with a frequency and a next due date (the job schedule shown in Components → Part C). [manual: Office PMS Technical manual, June rev, p.18] [manual: Vessel PMS Technical manual, June rev, p.16]
- The job must not already have an active work order — one active work order per job at a time. [code: server/services/jobDueScanner.ts:334-335, replit_dev cf5241ad6]
Steps:
1. Nothing to do. The ship system runs the job-due scan once every 24 hours by default (interval configurable through JOB_DUE_SCAN_INTERVAL_MS) and creates a work order for every job that is due. [code: server/routes.ts:166-178, replit_dev cf5241ad6] [code: server/services/jobDueScanner.ts:122-135,493-535, replit_dev cf5241ad6]
2. To see the result, open the 'Work Orders' sub-sub-module and use the status tabs: Scheduled (jobs planned with a future due date), Due (due within the current period), Overdue (past due date, not completed). [manual: Office PMS Technical manual, June rev, p.28] [manual: Vessel PMS Technical manual, June rev, p.23]
3. The work-order number is prefixed with the vessel code: <VESSELCODE>-<JOBCODE>-<COMPONENTCODE>-<YEAR>-<NNN>. [code: server/utils/workOrderNumbering.ts:7-11, replit_dev cf5241ad6]
Exceptions / edge cases:
- If a job already has an active work order, the scan does not create another one for it. [code: server/services/jobDueScanner.ts:334-335, replit_dev cf5241ad6]
- A work order can be generated ahead of the scan for one job with 'Generate WO' on the Components page — see office-generate-wo-per-job.md.
- On the office instance no scan runs. Office-side generation is done by a user in one of two ways: 'Generate Now' for a whole vessel (Sail Admin AND the vessel switch) — see office-generate-now.md — or per-job 'Generate WO' from Components (the vessel switch) — see office-generate-wo-per-job.md.
Where the manual differs:
- The June manuals do not describe automatic generation at all. They describe the Scheduled / Due / Overdue tabs [manual: Office PMS Technical manual, June rev, p.28] and the job frequency / next due date [manual: Office PMS Technical manual, June rev, p.18] but never say that the system creates the work orders. Recorded in CONFLICTS.md.
Related procedures: office-generate-now.md · office-generate-wo-per-job.md · unplanned-wo.md
Sources:
- Manual: `Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf` (Office, Revision 02, 08 June 2026), p.18, p.28 — text layer of the PDF.
- Manual: `PMS User Manual_Vessel Specific_R3_08.07.2026.pdf` (Vessel, Revision 03, 08 July 2026), p.16, p.23 — text layer of the PDF.
- Code: Technical repository at `origin/replit_dev` cf5241ad6 — `server/services/jobDueScanner.ts`, `server/routes.ts`, `server/utils/workOrderNumbering.ts`. The seven work-order files were verified byte-identical between the working branch and `origin/replit_dev`; the RUNNING Technical revision (Nilesh's dev/prod deployment, and the Replit phase2 fork) has NOT been verified as identical to cf5241ad6.
- Folder: `D:\manuals\SAIL - User Manuals\Technical module\` (folder dated 09-09-2026).
