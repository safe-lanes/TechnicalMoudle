// QA test cases — Approval Workflow round 2 (28/29-Sep-2026; build = the commit it is generated from). Same layout as the 04-Sep pack.
// Run from the repo root: node local-test-env/make_qa_docx_approvals_round2.cjs → docs/output/QA-TESTCASES-Approval-Workflow-Round2.docx
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, ShadingType, BorderStyle, PageOrientation,
} = require('docx');
const fs = require('fs');
// The build under test: the commit the pack is generated from (override with QA_BUILD).
const BUILD = process.env.QA_BUILD || require('child_process').execSync('git rev-parse --short HEAD').toString().trim();

const FONT = 'Arial';
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 20, ...o });
const para = (t, o = {}) => new Paragraph({ children: [run(t, o.run || {})], spacing: { after: 120 }, ...o.p });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(t, { size: 26, bold: true })], spacing: { before: 280, after: 120 } });

const AREAS = [
  { name: '1. Setup & Prerequisites', cases: [
    ['SET-01', 'Test server on the new build', `Office (shore) server and at least one vessel installation run build ${BUILD} (branch feature/approval-engine-phase2). Server restarted after deploy.`, 'Server starts without errors; database updates up to 179 applied automatically.'],
    ['SET-02', 'Vessel installation provisioned', 'Provision (or re-provision) the test vessel from the office server and run Sync Now once.', 'Sync completes with nothing left to send or receive.'],
    ['SET-03', 'Test users', 'Prepare: (a) Sail Admin; (b) an office APPROVER whose role is used in the approval chains, assigned to the test vessel in SAILERP (My Vessels); (c) a second office user with the SAME role NOT assigned to the vessel; (d) a vessel user who raises requests (e.g. Chief Engineer); (e) a second vessel user (e.g. 2nd Engineer); (f) the Master.', 'All users can log in.'],
    ['SET-04', 'Access Control', 'In Admin → Access Control give the approver/admin role VIEW + EDIT on "Approval Workflow" (PMS and Defects); give one other office role VIEW only.', 'Saved.'],
    ['SET-05', 'Email (optional)', 'If emails are to be tested: AWS_SES_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and APPROVAL_EMAIL_FROM set on the office server (IT / Ghazi — values never shared in chat).', 'Admin → Approval Workflow shows a green email banner. Without them: amber banner, in-app notifications only.'],
  ]},
  { name: '2. Combined Approval Workflow screen (Admin → Approval Workflow)', cases: [
    ['AW-01', 'One combined screen', 'Open Admin → Approval Workflow.', 'Single page: email banner + "Send approval emails" toggle at the top; tree on the left; editor on the right; two diagnostics boxes below. There is NO separate "Approval Engine" menu entry any more.'],
    ['AW-02', 'Tree content', 'Click Expand.', 'PMS: Components / Jobs / Spares / Stores → Change Request; Work Order → WO Postponement, WO Re-Postponement. Defects: Extension, Repeat Extension, Verification.'],
    ['AW-03', 'Old Level 1 / Level 2 ticks gone', 'Select any PMS item.', 'No Level 1 / Level 2 tick boxes and no old Edit button. Only the chain editor: "Enabled for this tenant", Mode, Classification buttons.'],
    ['AW-04', 'Create a chain', 'Select Spares → Change Request → "Normal Spares". Add a step with the approver role; Save workflow.', 'Saved; "Versions" shows v1 active; "Configured approvers" lists the step and the approver name(s).'],
    ['AW-05', 'Classifications per action', 'Click through each tree item.', 'Components: Normal / Critical Equipment · Jobs: Normal / Critical / Critical Equipment Jobs · Spares: Normal / Critical Spares · Stores: Store Items · WO Postponement and Re-Postponement: Normal / Critical / Critical Equipment WO · Defects: Critical Equipment / COC Related and Normal.'],
    ['AW-06', 'Defects settings', 'Select Defects → Extension.', '"Defects approval settings" panel: extension-longer-than days (default 90) and "Show rejected closure attempts on the printed defect report"; Save settings works.'],
    ['AW-07', 'View-only role', 'Log in with the VIEW-only role (SET-04) and open the screen.', 'Screen opens; trying to save a chain or settings is refused with a permission message.'],
    ['AW-08', 'No permission', 'Log in with a role that has no Approval Workflow permission.', 'Screen shows "You do not have permission to access this page."'],
    ['AW-09', 'Enabled for this tenant', 'Untick "Enabled for this tenant" for one action; save; try to submit that request type in the office.', 'Submission refused: "Approval for … is switched off. Ask an administrator to enable it in Admin → Approval Workflow." Re-tick afterwards.'],
  ]},
  { name: '3. Diagnostics (bottom of the Approval Workflow screen)', cases: [
    ['DG-01', 'Compact summary', 'Open the screen with some actions not set up.', '"Approval diagnostics" box shows only red chips (e.g. "19 actions without an approval chain", "1 role nobody holds") and a "View details" button. Details are NOT shown until clicked.'],
    ['DG-02', 'View details', 'Click "View details".', 'Pop-up lists each problem group with what it means and "What to do". Close with ✕.'],
    ['DG-03', 'Action without a chain', 'Leave e.g. Components → Normal Equipment without a chain.', 'Listed under "Approval actions that cannot be submitted". After setting up the chain and reloading, it disappears.'],
    ['DG-04', 'Role nobody holds', 'Put a role in a chain that no user holds for the vessel.', 'Listed under "Approval roles nobody holds" with the vessel names.'],
    ['DG-05', 'Request nobody can approve', 'Submit a request that reaches that step.', 'Listed under "Approvals waiting with nobody able to approve them" with the waiting date.'],
    ['DG-06', 'Failed update + Apply again', 'BACKEND-ASSISTED (developer creates the state): an approval finished but the record did not update.', 'Listed under "Approvals finished but the record was not updated" with an "Apply again" button. View-only role: refused. Admin: "Applied." and the row disappears; the record is now approved/rejected.'],
    ['DG-07', 'Healthy state', 'All actions set up, all roles held, nothing stuck.', 'Box shows "No problems found."'],
    ['DG-08', 'Defects diagnostics', 'Check the second box.', 'Sahil\'s "Defects approval diagnostics" box: chips + "View details" pop-up (steps not set up, vessels needing approvers, stalled / never-sent extensions).'],
  ]},
  { name: '4. Change Requests (Modify PMS) — engine approvals only', cases: [
    ['CR-01', 'No chain → refused in the office', 'Office user submits a Change Request for an action/classification with NO chain.', 'Refused: "No approval workflow is set up for "…" (…). Ask an administrator to set it up in Admin → Approval Workflow." CR stays draft.'],
    ['CR-02', 'No chain → ship still accepts', 'On the vessel, submit the same kind of CR; Sync.', 'Vessel accepts (it cannot see the office chains): status Pending Approval. It waits in the office until a chain exists; after the chain is set up and the vessel syncs again, the chain starts.'],
    ['CR-03', 'Chain starts on submit', 'With a chain (AW-04), vessel user submits a Spare CR; Sync.', 'Office: approver gets a bell notification "Approval required …" (+ email if configured). CR shows "Approval progress" with the step.'],
    ['CR-04', 'Approver approves', 'Approver opens the CR in Modify PMS and clicks Approve.', 'CR Approved; the spare value is changed; requester notified. After Sync the vessel shows Approved and the new value.'],
    ['CR-05', 'Approver rejects', 'New CR; approver clicks Reject with remarks.', 'CR Rejected with remarks; spare unchanged; requester notified.'],
    ['CR-06', 'Non-approver / unassigned approver', 'Open the pending CR as (c) from SET-03 and as a user without the role.', 'No Approve/Reject buttons (or a refusal if forced).'],
    ['CR-07', 'Vessel cannot decide', 'On the vessel, as Sail Admin, try to approve a pending CR.', 'Refused: "Approval happens in the office. This request will be decided on shore and the result will reach the vessel by sync."'],
    ['CR-08', 'Critical classification', 'CR on a Critical spare / critical component.', 'The Critical chain is used (not the Normal one).'],
    ['CR-09', 'Work Order change requests', 'Raise a Modify PMS change request in the "Work Orders" category.', 'Keeps today\'s behaviour — no approval chain needed (by decision).'],
  ]},
  { name: '5. WO Postponement / Re-Postponement', cases: [
    ['PP-01', 'Vessel requests a postponement', 'On the vessel, postpone a due WO (new date + reason); Sync.', 'Vessel: WO "Awaiting Office Approval". Office: chain starts; approver notified.'],
    ['PP-02', 'Approve', 'Approver approves the postponement.', 'WO "Postponement Approved" with the new due date. After Sync the vessel shows the same.'],
    ['PP-03', 'Reject', 'New request; approver rejects with remarks.', 'WO back to its original due date and status; remarks kept. Vessel shows it after Sync.'],
    ['PP-04', 'Re-postponement', 'On a Postponement-Approved WO, request a re-postponement; Sync; approve.', 'Re-postponement chain used; approved date applied. Reject returns the WO to the previous approved postponement.'],
    ['PP-05', 'No chain', 'Office user requests a postponement where no chain exists.', 'Refused with the "No approval workflow is set up …" message.'],
  ]},
  { name: '6. Withdraw a pending request (NEW — sender only)', cases: [
    ['WD-01', 'Button only for the sender', 'Open a pending CR (Modify PMS → CR dialog) as the person who sent it, then as anyone else.', 'Sender sees "Withdraw request"; nobody else does.'],
    ['WD-02', 'Withdraw a CR in the office', 'Office sender: Withdraw request → optional reason → Withdraw.', 'Message "Request withdrawn — the approvers have been told." Dialog closes; CR back to Draft. Reopening shows "Withdrawn by <name> on <date>" and the reason. Approver gets a bell notification "Withdrawn: …". CR can be edited and sent again.'],
    ['WD-03', 'Withdraw a CR on the vessel', 'Vessel sender withdraws a pending CR (chain running in the office).', 'Message "Withdrawal sent — the office cancels the request when this reaches shore by sync." Note: "Withdrawal sent … waiting for the office (after sync)". CR still Pending on board.'],
    ['WD-04', '… after sync', 'Sync the vessel (twice if needed).', 'Office: request cancelled automatically — approver does NOTHING; CR Draft; approver notified. Vessel after next Sync: CR Draft, note "Withdrawn by …".'],
    ['WD-05', 'Too late', 'Vessel sender withdraws a pending WO postponement, but BEFORE the vessel syncs the approver approves it in the office. Then Sync twice.', 'The approval stands (Postponement Approved). Vessel note: "Withdrawal too late: Already decided before the withdrawal arrived … the decision stands."'],
    ['WD-06', 'Withdraw a WO postponement in time', 'Vessel sender opens the WO postpone dialog (Awaiting Office Approval) → Withdraw request; Sync.', 'WO keeps its ORIGINAL due date; no longer Awaiting Office Approval; approver notified. Vessel shows the same after Sync.'],
    ['WD-07', 'Withdraw a defect extension', 'Sender opens the defect, Part B5, current extension (Requested) → Withdraw request.', 'Extension shows WITHDRAWN; target date unchanged; approver notified. A NEW extension can be requested afterwards.'],
    ['WD-08', 'Verification cannot be withdrawn', 'Pending defect verification.', 'No Withdraw button for verification.'],
    ['WD-09', 'Only once', 'Vessel sender withdraws, then tries again before sync.', 'Refused: "A withdrawal is already waiting for the office."'],
    ['WD-10', 'Old requests', 'A request sent before this build was installed.', 'No Withdraw button (the sender was not recorded then). Not a defect.'],
    ['WD-11', 'Decided request', 'Open an approved or rejected request as its sender.', 'No Withdraw button.'],
  ]},
  { name: '7. Defects — Extension, Verification, Closure', cases: [
    ['DF-01', 'Extension request (vessel)', 'Vessel: defect Part B5 → new target date + reason → submit; Sync.', 'Entry "Requested"; no "Approved?" option on the vessel; office chain starts; approver notified.'],
    ['DF-02', 'Approve / reject extension', 'Approver approves (then on another defect rejects).', 'Approved: target date moves to the new date, confirmation shows the approver. Rejected: target date unchanged, remarks kept.'],
    ['DF-03', 'Longer than the threshold', 'Request an extension longer than the Defects setting (default 90 days) on a Normal defect.', 'Treated as Critical Equipment / COC Related (critical chain used).'],
    ['DF-04', 'Repeat extension', 'Second extension on the same defect.', 'Repeat Extension chain used; if none is set up, the first-extension chain is used.'],
    ['DF-05', 'No chain in the office', 'Office user requests an extension where no chain exists.', 'Refused: "No approval workflow is set up for "…" …". (Vessel requests still wait in the office.)'],
    ['DF-06', 'Closure blocked while extension pending', 'Master tries Part C1 Closeout while an extension is pending.', 'Refused: "This defect has a pending extension approval; complete that approval before closing the defect."'],
    ['DF-07', 'Master-only closure', 'Non-Master opens Part C1; then the Master completes it.', 'Non-Master: fields disabled. Master: closes; verification chain starts in the office.'],
    ['DF-08', 'Verification approve / return', 'Verifier verifies; on another defect returns it.', 'Verified with the verifier\'s name. Returned: defect reopened, a closure-history entry is recorded.'],
    ['DF-09', 'Closure evidence', 'Attach closure files; close; then try to remove a closure file.', 'Only files uploaded to the defect can be used. After closing (or after a rejected closure) removal is refused: "Closure evidence cannot be removed once the defect is closed…"'],
    ['DF-10', 'Closure history reaches the vessel', 'After DF-08 (return), Sync the vessel.', 'The closure history entry is visible on the vessel too.'],
  ]},
  { name: '8. Defect status — Extended vs Overdue', cases: [
    ['ST-01', 'Extended, not overdue', 'Defect whose original target date has passed but an APPROVED extension moves it into the future.', 'Shown as "Extended" (not Overdue) in the defect list, dashboard and reports; no overdue alert.'],
    ['ST-02', 'Overdue after the new date', 'Extended defect whose NEW date has also passed.', 'Shown as Overdue everywhere; overdue alert raised.'],
    ['ST-03', 'Reports group', 'Open the defect status report.', '"Extended" appears as its own group; counts match the list.'],
  ]},
  { name: '9. Defect PDF report', cases: [
    ['PDF-01', 'All extensions printed', 'Defect with two or more extensions (approved, rejected, withdrawn) → Export PDF.', 'Every extension printed with its status — not only the latest.'],
    ['PDF-02', 'Rejected closures — setting OFF', 'Defect with a returned verification; setting "Show rejected closure attempts…" OFF.', 'PDF does not list rejected closure attempts.'],
    ['PDF-03', 'Rejected closures — setting ON', 'Turn the setting ON (AW-06); export again.', 'PDF lists the rejected closure attempts (who, when, reason).'],
  ]},
  { name: '10. Notifications & email', cases: [
    ['NT-01', 'Bell notifications', 'Run CR-03, CR-04, WD-02.', 'Approver: "Approval required"; requester: approved / returned; approver: "Withdrawn" (grey). Click marks as read.'],
    ['NT-02', 'Nobody to approve for 24 h', 'BACKEND-ASSISTED: a step with nobody able to approve, older than 24 hours.', 'Sail Admin gets one notification "Approval waiting with nobody to approve (step …)" — not repeated every hour.'],
    ['NT-03', 'Email on (if SES set)', 'Toggle ON; run CR-03.', 'Approver receives an email as well as the bell notification.'],
    ['NT-04', 'Email toggle off', 'Toggle OFF; run CR-03.', 'No email; bell notification still arrives; approval works.'],
  ]},
  { name: '12. Approval process — who and when (NEW, Jeevan)', cases: [
    ['AP-01', 'WO completion history', 'Vessel: submit a WO completion; Chief Engineer rejects with remarks; submit again; Chief Engineer approves. Open the WO form and scroll to the bottom.', '"Approval process" section: Attempt 1 — Submitted, Rejected (with remarks); Attempt 2 — Resubmitted, Approved. Each line shows name (rank) and date + time like the Defects screen (e.g. 29 Sep 2026, 1228 Z).'],
    ['AP-02', 'Tech. Sup. acknowledgement', 'On a WO locked for Technical Superintendent acknowledgement, acknowledge in the office; open the WO form.', '"Acknowledged by Technical Superintendent" with the name (position) of the person who acknowledged and date + time, after the WO approval lines.'],
    ['AP-03', 'Postponement history', 'Vessel requests a postponement; office rejects; vessel requests again; office approves. Open the WO form (and the postpone dialog).', 'Postponement: Attempt 1 — Requested, Rejected — <step name>; Attempt 2 — Requested again, Approved — <step name>, each with name (rank) and date + time.'],
    ['AP-04', 'Re-postponement history', 'Repeat AP-03 as a re-postponement.', 'Same, under "Re-Postponement".'],
    ['AP-05', 'Change request history', 'Vessel submits a Modify PMS change request (Components, Jobs, Spares or Stores); office approves (or rejects). Open the CR dialog.', '"Approval process" in the dialog: Submitted — name (rank) + time; Approved/Rejected — <step name> — approver name (position) + time, with remarks.'],
    ['AP-06', 'Withdrawal shown', 'Withdraw a pending CR from the vessel; sync.', 'History shows "Withdrawal requested" (vessel) and then "Withdrawn" with name and time.'],
    ['AP-07', 'Same on the vessel', 'After each case above, Sync the vessel and open the same screen on the vessel.', 'The vessel shows exactly the same history as the office.'],
    ['AP-08', 'Older records', 'Open a WO / CR completed before this build.', 'The section shows what was captured; missing names or times show "Not Recorded" (not a defect).'],
  ]},
  { name: '11. Ship ↔ Office sync (end to end)', cases: [
    ['SY-01', 'Results reach the vessel', 'After each office decision / withdrawal above, Sync the vessel.', 'Vessel shows the same status, dates and notes as the office.'],
    ['SY-02', 'Clean sync', 'After the whole round, Sync twice.', 'Nothing left to send or receive; no sync errors on the Sync Dashboard.'],
  ]},
];

// Shared with the Excel checklist (make_qa_xlsx_approvals_round2.cjs) so both files always say the same.
const TITLE = 'QA Test Cases — Approval Workflow (Round 2): combined screen, engine-only approvals, withdraw, approval process, Defects';
const SCOPE = [
  '1. One combined Admin → Approval Workflow screen (tree, chain editor, Defects settings, email banner, diagnostics). The separate "Approval Engine" page is removed.',
  '2. Change Requests and WO Postponement / Re-Postponement are approved ONLY through the approval chains. The old Level 1 / Level 2 ticks are retired. With no chain, office submissions are refused; vessel submissions wait in the office.',
  '3. NEW: the sender can withdraw a pending Change Request, WO (re-)postponement or defect extension. The office cancels it automatically; approvers are notified.',
  '4. Defects: extension / repeat extension / verification approvals, Master-only closure, closure evidence protection, closure history on the vessel, one Extended/Overdue rule, full PDF.',
  '5. Diagnostics with "Apply again", and a Sail Admin warning when an approval has had nobody to approve it for 24 hours.',
  '6. NEW: "Approval process" section — who submitted / approved / rejected / acknowledged / withdrew and when (name + rank, date + time, every attempt) on the WO form, the postponement dialogs and the change request dialog.',
];
const INTENTIONAL = [
  '• The vessel never approves: approvals happen in the office and reach the vessel by sync.',
  '• A vessel can submit a request even when the office has no chain; it waits in the office until one is set up.',
  '• Requests sent before this build cannot be withdrawn (no sender was recorded).',
  '• A withdrawal from the vessel takes effect only after sync; if the office decided first, the decision stands ("too late").',
  '• Modify PMS change requests in the "Work Orders" category need no approval.',
  '• Without email settings on the server, only in-app (bell) notifications are sent.',
  '• Approval process times are shown in UTC with a "Z" (e.g. 29 Sep 2026, 1228 Z) — the same as the Defects screen.',
  '• Work Orders, postponements and change requests from before this build show "Not Recorded" where the name or time was never saved.',
  '• The WO completion approval itself works as before (approver set in the WO form); only the who / when display is new.',
];
const KNOWN_ISSUES = [
  '• Change request dialog: the "Requested By" field at the top shows the user id instead of the name (existing behaviour; the Approval process section below it shows the name). Already reported — no need to log again.',
];
module.exports.TEXTS = { TITLE, SCOPE, INTENTIONAL, KNOWN_ISSUES };

const CELL_BORDERS = { top: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' } };
const W = [1000, 2300, 4700, 4900, 1500]; // sum 14400
function headerRow() {
  return new TableRow({ tableHeader: true, children: ['TC ID', 'Test Case', 'Steps / Preconditions', 'Expected Result', 'Pass / Fail'].map((t, i) =>
    new TableCell({
      width: { size: W[i], type: WidthType.DXA }, borders: CELL_BORDERS,
      shading: { type: ShadingType.CLEAR, fill: '1F4E79' },
      children: [new Paragraph({ children: [run(t, { bold: true, color: 'FFFFFF' })] })],
    })) });
}
function caseRow([id, title, steps, exp]) {
  const cells = [[run(id, { bold: true })], [run(title)], [run(steps)], [run(exp)], [run('')]];
  return new TableRow({ children: cells.map((ch, i) => new TableCell({
    width: { size: W[i], type: WidthType.DXA }, borders: CELL_BORDERS,
    children: [new Paragraph({ children: ch, spacing: { after: 40 } })],
  })) });
}

module.exports.AREAS = AREAS;
if (require.main !== module) return;

const total = AREAS.reduce((n, a) => n + a.cases.length, 0);
const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [run(TITLE, { size: 32, bold: true })], spacing: { after: 120 } }),
  para(`Branch: feature/approval-engine-phase2   ·   Build: ${BUILD}   ·   Date: 30-Sep-2026   ·   ${total} test cases`, { run: { italics: true, size: 20 } }),
  h1('Scope of this round'),
  ...SCOPE.map((t) => para(t)),
  h1('Known intentional behaviour — do NOT log as a defect'),
  ...INTENTIONAL.map((t) => para(t)),
  h1('Known issue — already reported'),
  ...KNOWN_ISSUES.map((t) => para(t)),
  h1('How to record results'),
  para('Write Pass or Fail in the last column. For every Fail give: TC ID, user and role, vessel, office or vessel installation, time, a screenshot, and the exact message shown. BACKEND-ASSISTED cases need a developer to prepare the state.'),
];
for (const area of AREAS) {
  children.push(h1(area.name));
  children.push(new Table({ width: { size: 14400, type: WidthType.DXA }, columnWidths: W, rows: [headerRow(), ...area.cases.map(caseRow)] }));
}

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
    children,
  }],
});
Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync('docs/output', { recursive: true });
  fs.writeFileSync('docs/output/QA-TESTCASES-Approval-Workflow-Round2.docx', buf);
  console.log(`docx written, ${total} cases`);
});
