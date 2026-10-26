# Deploy note — replit_dev release of 25-Oct-2026 (Approval Workflow + Office Reviewer + Job Work Instructions)

**For Nilesh (deployment) and Jeevan.** Written 23-Oct-2026 by support, updated 25-Oct-2026 (Ghazi's decisions).

## 0. Release at a glance

- **Branch to deploy: `replit_dev`, build `08b6035a9`** (application code = `d01218668`; the two commits after it
  are QA-pack generator scripts only).
- **All branches are now the same code:** `replit_dev` = `feature/replit-work` = `feature/approval-engine-phase2`
  = `feature/job-work-instructions` = `08b6035a9`. The approval branch is fully merged — **track `replit_dev` only**
  from now; nothing needs to be taken from the approval branch any more.
- **Replit forks (Nilesh, Jeevan) are already updated** with this code by Ghazi.
- **What is in it (since the 15-Oct release 4e93a5245):** Approval Workflow phase 2 (combined Admin → Approval
  Workflow screen, chains per classification, withdraw a pending request, approval history "who + when", multi-step
  approver edits, defects extension / verification / closure approvals, Round-2 QA fixes + Jeevan's points) ·
  Nilesh's Office Reviewer roles on Jobs · Jeevan's defect exports (browser PDF, CSV/xlsx), DD-MM-YYYY dates, admin
  URL state · **NEW: Job "Work Instructions" — PDF attachments on Jobs** (section 5).
- **Deploy order: office server first, then every ship, same build.** Reason: `approval_history` /
  `approval_withdrawals` sync both ways and the new Work Instructions tables sync office → ship.
- **Migrations (all additive, idempotent, run automatically on start):** 178, 179, 180, 183.
- **QA on this build:** Suman runs "Approval Workflow Round 3" (47 cases) and "Job Work Instructions" (49 cases)
  on dev once it is up. Both packs name build `d01218668`.
- **Rollback:** previous replit_dev release = `4e93a5245` (15-Oct). Migrations 178–183 are additive, so rolling the
  code back leaves the new tables/columns in place harmlessly.

## 1. Old approval history rows that say "(Chief Engineer)" for office users — NOT corrected

- **Background:** before this build, an office user without a rank was saved in the approval history with the
  default rank "Chief Engineer" (e.g. "Jeevan Naik (Chief Engineer)"). New rows are correct (designation, then role).
- **Decision (Ghazi):** the old rows are **left as they are**. Nilesh / Jeevan may correct them themselves after
  deployment if they want.
- **To find them (read-only):**

```sql
SELECT h.ahuuid, h.subject_type, h.event_type, h.actor_name, h.actor_position, h.occurred_at
FROM approval_history h
JOIN master_users u ON u.id = h.actor_uuid
WHERE h.actor_position = 'Chief Engineer' AND u.user_type = 'Office';
```

  If corrected, use the user's designation (or role) from `master_users`. `approval_history` syncs both ways, so
  correct it on the office server only and let sync carry it.

## 2. Defects → Reports page shows "Coming soon"

- The page only had fixed sample numbers, its 7 report ids do not exist on the server, and its Export buttons did
  nothing. It is switched to "Coming soon" (`COMING_SOON = true` in `client/src/pages/defects/DefectsReports.tsx`)
  until Jeevan says which reports are needed and what each shows. Defect form / Defect Log PDF export work.

## 3. Component Jobs export test needs Jeevan's template file

- `server/__tests__/component-jobs-export.test.ts` compares the export with
  `attached_assets/jobs_template_(37)_1790855295976.xlsx`. `attached_assets/` is git-ignored, so the file exists
  only in Jeevan's Replit workspace; elsewhere the test is skipped (with the reason). Left as is (Ghazi).

## 4. Things to watch on deploy (Approval Workflow / Office Reviewer / defects)

- **Migrations in this release:** `178_approval_withdrawals.sql`, `179_approval_history.sql` (approval branch) and
  `180_jobs_office_reviewer_role_ruids.sql` (from replit_dev). All idempotent.
- **Office server and ships must run the same build** — `approval_history` and `approval_withdrawals` sync both
  ways; `defect_closure_history` shore → ship.
- **PDF export:** do not let Replit put back the jspdf stub (`vite.config.ts` aliases to `client/src/lib/stubs`).
  With the stub every browser PDF export does nothing.
- **Office Review (Jobs):** a Job with the old "Reviewer Rank" set and no Office Reviewer roles **still goes to office
  review**. Choosing Office Reviewer roles replaces the old setting (clears it). Any office / admin user can review.
- **Modify PMS approver edits:** every approver in a multi-step chain may change a requested value; the last change
  for a field wins and is what gets applied.
- **Defect numbers:** vessels with a V-code number new defects as `<VCODE>-YY-NNNN` (office `…-ONNNN`); vessels
  without a V-code keep the old format; existing defects keep their numbers.
- **Part A:** locked after the first save; only Sail Admin can unlock (one edit, reason recorded).

## 5. Job Work Instructions (PDF attachments on Jobs) — NEW in this release

- **Migration:** `183_job_work_instructions.sql` — two new tables (`job_work_instruction_files`,
  `job_work_instruction_links`), additive, idempotent. No existing table is changed.
- **Office server and ships must run the same build.** Both tables sync shore → ship, and the PDF bytes travel by the
  existing file sync into `.private/job-docs/` on the ship (same mechanism as component documents). Deploy the
  office first, then the ships; a ship on the old build receiving the new tables was not tested.
- **Storage on the office server:** PDFs are written under `.private/job-docs/<vessel uuid>/`. Make sure that folder
  is on the same disk/backup as `.private/` today (PM2 cwd). On Replit the object store is used instead.
- **Ships are read-only** for Work Instructions by design: upload / attach / remove / restore are refused on a ship
  (HTTP 403 "managed in the office"). Not a bug.
- **Bulk import (Jobs):** the Vessel_Job template has a new last column **"Job attachments"** (PDF file names,
  `;`-separated, of PDFs already uploaded for that vessel). The hidden template-version cell moved from column 28 to 29.
  Old templates without the column keep working.
- **Permission:** uses the existing Job-edit permission (`pms-modify-pms` edit). Nothing to configure.
- **Multi-file upload:** Admin → Bulk Upload → Jobs has a "Work Instruction PDFs" box that stores many PDFs for the
  vessel in one request (up to 100 files, 25 MB each) without attaching them to Jobs — the Jobs sheet then names them.
  Same storage, same sync; nothing extra to configure.
- **Fresh provisioning** of a ship carries the rows in the bundle and queues the PDFs; they arrive on the first sync.

## 6. Sync — "defect_sequences … missing NOT-NULL column(s) [year]" / "Still to receive: 22" (dev vessel 74481b72, 26-Oct-2026)

- **What it was:** the per-vessel defect-number counter (`defect_sequences`) was still marked as a two-way sync table and
  matched by its local integer id (office row 16 ≠ ship row 1 for the same vessel/year), so old office updates of that
  counter could never be applied on the ship and were re-offered on every sync. Since 15-Oct each side numbers its own
  defect series and the office no longer writes this counter — these were leftover logs from before 15-Oct.
- **Fix in this build:** `defect_sequences` is now `NO_SYNC` (never travels). Any leftover logs for it are **retired
  automatically** on the next sync of each vessel (office log line `PREPARE-PULL RETIRED: … defect_sequences …`) —
  no SQL needed. "Still to receive" drops to 0 on that sync.
- **Check (read-only, office DB) if you want to see what will be retired:**

```sql
SELECT vessel_id, count(*), min(changed_at), max(changed_at)
FROM sync_field_log WHERE table_name = 'defect_sequences' AND is_synced = false
GROUP BY vessel_id;
```
