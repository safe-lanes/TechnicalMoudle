# Deploy note — sync identity fixes (Testvessel follow-up), October 2026

Branch: `fix/sync-identity-defect-numbering` (based on `replit_dev` d2c74ac10).
Audience: Nilesh (deploy), support. Written 14-Oct-2026.

## What this release fixes

| Area | Before | After |
|---|---|---|
| **Modify PMS approval steps** (Level 1 / Level 2) | A step created on one side could not be saved on the other ("FK retry failed: null value in column change_request_id") and was re-sent every sync. Seen on Testvessel. | The other side finds the change request by its permanent ID and saves the step against its own local number. If the change request has not arrived yet, the step waits. |
| **Modify PMS comments and attachments** | Arrived on the other side pointing at the wrong change request, or at none. | Linked by the change request's permanent ID (database change 181). |
| **Defect numbers** | Office and ship numbered defects from the same series. Two defects raised between syncs could get the same number, and one overwrote the other. | Ship defects keep their format (`D048-26-0004`). Office defects get their own series: **`D048-26-O0001`**. Existing defects keep their numbers. If two different defects ever share a number (old data), both are kept and nothing is overwritten. |
| **Defect counter** | Synced by row number, and failed on Testvessel ("defect_sequences … missing [year]"). | No longer synced. Each side numbers its own series from the defects themselves. |
| **Component documents** | An office upload and a ship upload between syncs both got number 1, and each side silently kept only its own. | Each document gets a permanent ID (database change 182). Both documents reach both sides. |
| **Setting up a new ship (provisioning)** | Maintenance history, component documents (and requisitions, running-hours log, class/regulatory items) were left out of the setup package — 0 rows — and the setup check still said "verified". A ship set up later also never received the document files. | These tables are included. The setup also re-offers the vessel's document and attachment files to the new ship. |
| **Sync Now result on the ship** | Errors on the office side reached the ship only as a count. Sync Now showed only the last round's errors. | The ship shows "Office could not apply: …" lines, collected from all rounds. |

## Rollout order

**Office (shore) first, ships afterwards at their night update.** This order is supported and was tested on the shore+ship pilot.

While a ship still runs the previous version:
- it keeps syncing normally;
- **document changes made in the office wait for that ship.** Its Sync screen shows them under "Still to receive" until its night update. This is expected, not an error;
- a new document uploaded on that ship reaches the office;
- an edit the ship makes to an existing document waits until its update.

After the ship's update, everything that was waiting goes through on the next sync.

## Database changes (run automatically on start-up)

- **181** `181_cr_children_change_request_uuid.sql`: adds the change request's permanent ID to Modify PMS comments and attachments.
- **182** `182_component_documents_cduuid.sql`: adds a permanent ID to component documents.

Both are additive and safe to run twice. **180 is left free** for the office-reviewer work.

## Checks after deploy (office)

1. The server log shows `Applying SQL migration: 181_…` and `182_…`, both applied successfully, with no errors.
2. Raise one test defect for a test vessel from the office. Its number must contain `-O` (e.g. `D048-26-O0001`).
3. On a ship that has already been updated, run Sync Now. It should show no "change_request_approval" or "defect_sequences" errors.

## Rollback

Going back to the previous version after this release has one known effect. The **office's defect counter** was not updated while the new version ran, so the old version could pick a number that is already used, and **creating a defect then fails**. Before rolling back, ask support for the counter reset query.

## Not in this release (known, separate)

- Old ship edits of shared component documents may have landed on the wrong document in the office (or the reverse) before this release. Check per vessel with docs/output/component-documents-wrong-edit-check.sql; repair only what it finds.

- Component requisitions: same row-number weakness, but no screen creates requisitions today, so nothing to fix now (ask Jeevan if they will be used). Surveys S1–S5 are built-in sample rows with no vessel and never sync — no issue.
- Six office-to-ship tables scoped by vessel code (fleet mappings, master data, component class/regulatory) are skipped during normal sync. Not changed here; it needs a decision first.
