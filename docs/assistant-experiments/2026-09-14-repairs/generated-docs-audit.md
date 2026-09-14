# Audit of the five GENERATED Technical documents (14-Sep-2026)

The five `Technical - … (Operational) ….docx` files in the assistant's corpus were NOT supplied by
the product team. They were written by the assistant's own build session (session 35, 10-Sep-2026,
`C:\tmp\trag\documents\`) from the codebase, because no original manuals exist for bulk import,
sync, roles, ship-side operation and post-June behaviour changes. They are absent from
`D:\manuals`. Their hashes on the server match the local originals (ba200e864d3caf26,
6a93bd2383064b27, 97a3fedab09bf22a, 69857b38989de51b, 083e08c13944c1a7).

Owner rule (14-Sep): generated text is NOT authoritative — every instruction was checked against
the code by three read-only audit agents; one verdict was re-checked by hand (see "Correction").
Verdicts: SUPPORTED = code/route/label proves it · PARTLY = feature exists but wording, path,
label or scope differs · UNSUPPORTED = no evidence or contradicted by the code.

| document | SUPPORTED | PARTLY | UNSUPPORTED | outright-wrong instructions |
|---|---|---|---|---|
| Bulk Data Import | 13 | 10 | 1 | "Job codes must be filled in and unique" — Job Code is optional and auto-generated (`validationService.ts:217`, `JobUpload.tsx:50`) |
| Ship-Side Operational Notes | 16 | 3 | 0 | none outright; "a lower reading is still saved" is true only for back-dated readings (a plain lower reading is hard-blocked, `rhTimelineValidationService.ts:310`) |
| Recent Updates & Changed Behaviours | 22 | 9 | 1 | "run Sync Masters to populate vessel codes" — `vessels` is NO_SYNC; codes reach ships only via provisioning or a one-time UPDATE (`docs/SYNC-ARCHITECTURE.md:24-27`) |
| Roles & Permissions | 19 | 15 | 1 | "an HOD can do everything an office user can for their department" — no department-scoped permission layer exists; HOD is even excluded from postponement approval |
| Sync | 28 | 9 | 1 (after correction) | "amber also means changes waiting to go out" — stale is time-based only (`SyncFleetOverview.tsx:134-142`) |

**Correction to the Sync audit:** the agent marked "the vessel code used in work-order numbers" as
UNSUPPORTED citing `workOrderNumbering.ts:11-17`. Re-checked by hand: the file's own spec and code
prefix both planned and unplanned numbers with `<V_CODE>-` (`server/utils/workOrderNumbering.ts:7-11`,
`:60-86`, `:119-131`), falling back to the legacy format only when the vessel has no v_code. The
claim is SUPPORTED; the Sync document's count is corrected to 1 UNSUPPORTED.

## Highest-risk PARTLY items (a user following the text will be misled)

- Bulk import lives under **PMS → Admin → "Bulk Data Imp"** tab, not "Admin → Bulk Data Import"; the
  dry-run runs automatically on file selection and reports ok/warning/error per row (created/updated/
  skipped appear only after the import); "Work Orders" is not an importable type (only WO History);
  buttons are "Import N Records" / "Skip Errors & Import N Valid Rows"; history is "Import History";
  there is no selective re-import of failed rows (there IS an Undo of a whole import).
- Roles: "Vessel Admin" is a SAILERP profile role mapped into Head of Dept, and "Level 2 Reviewer" is
  a job rank field — neither is an assignable UI role; the Me / My Team toggle exists on the PMS
  Dashboard only, is shown to every non-admin scope (not only HOD), and filters work-order KPIs only;
  server-side write permission checks (`requirePermission`) are opt-in and pass-through by default —
  real enforcement is `requireRole`; the per-vessel switches live on the "Lead Time & Grace Period
  Settings" screen; the approval-workflow screen configures two fixed levels, not an arbitrary chain,
  and approver identities are not set there.
- Recent updates: only a Sail Admin may run office WO generation (ordinary office users get a role
  refusal); rejected work orders re-compute to Due OR Overdue; the superintendent notifications page
  is scoped to the selected vessel, not to the superintendent's fleet.
- Sync: the Fleet Overview eye icon opens the Sync Dashboard without passing the vessel; sorting is
  oldest-sync-first (a recently synced vessel with conflicts sinks to the bottom); one "Sync Now"
  stops after 20 cycles / 60 s / no progress; the conflict notification goes to the rejected SENDER
  (normally the ship user), not to the office user whose edit lost; the Data Masters button is
  labelled "Sync All"; in-code inconsistency worth raising with the product team: badge amber at
  >24 h but the "Stale" summary card counts >48 h (`SyncFleetOverview.tsx:257-262, 362`).

## Disposition (owner decision pending)

The five documents stay in the corpus unchanged for this comparison (the acceptance suite does not
touch them). Recommended follow-up, not done here: correct the four outright-wrong sentences and the
high-risk PARTLY wordings in the source .docx files, re-parse only those five files, and mark each
generated document with a "derived from code, revision R3" note. Full per-claim tables from the
three audits are in `generated-docs-audit-detail.md` next to this file.
