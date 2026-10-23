// QA test cases — Approval Workflow round 3 (23-Oct-2026; build = the commit it is generated from). Same layout as round 2.
// Round 3 = re-test of the Round 2 failures + Jeevan's points (bugs, multi-level approvals, enhancements) + a short regression.
// Run from the repo root: node local-test-env/make_qa_docx_approvals_round3.cjs → docs/output/QA-TESTCASES-Approval-Workflow-Round3.docx
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, ShadingType, BorderStyle, PageOrientation,
} = require('docx');
const fs = require('fs');
// The build under test: the commit the pack is generated from (override with QA_BUILD).
const BUILD = process.env.QA_BUILD || require('child_process').execSync('git rev-parse --short HEAD').toString().trim();
const DATE = '23-Oct-2026';

const FONT = 'Arial';
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 20, ...o });
const para = (t, o = {}) => new Paragraph({ children: [run(t, o.run || {})], spacing: { after: 120 }, ...o.p });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(t, { size: 26, bold: true })], spacing: { before: 280, after: 120 } });

const NO_CHAIN_MSG = 'No approval workflow is set up for "…" (…). Ask an administrator to set it up in Admin → Approval Workflow.';

const AREAS = [
  { name: '1. Setup & Prerequisites', cases: [
    ['SET-01', 'Test servers on the new build', `Office (shore) server AND the vessel installation run build ${BUILD} (branch feature/approval-engine-phase2). Both restarted after deploy.`, 'Both start without errors. No new database changes in this round (same database as Round 2 is fine).'],
    ['SET-02', 'Vessel synced', 'Run Sync Now on the vessel once.', 'Sync completes with nothing left to send or receive.'],
    ['SET-03', 'Test users', 'Same users as Round 2: (a) Sail Admin; (b) office APPROVER (role used in the chains) assigned to the test vessel in SAILERP; (c) a second office user with the SAME role NOT assigned to the vessel; (d) vessel user who raises requests (e.g. Chief Engineer); (e) second vessel user (e.g. 2nd Engineer); (f) the Master. NEW: (g) an office user who holds TWO approver roles (for ML-04); (h) an office user with VIEW-only Approval Workflow permission.', 'All users can log in.'],
    ['SET-04', 'Chains', 'In Admin → Approval Workflow set up chains for: Spares Change Request (Normal Spares), WO Postponement + WO Re-Postponement (Normal WO), Defects Extension + Verification (Normal). For section 4 also a TWO-step chain (see ML-01).', 'Saved; each shows "v1 active".'],
  ]},
  { name: '2. Re-test — failed or partly passed in Round 2', cases: [
    ['CR-01', 'No chain → the REAL message', 'Office user: Modify PMS → Spares → raise a change request for a classification that has NO chain → Submit. Repeat for Jobs, Stores and Components.', `The real reason is shown: ${NO_CHAIN_MSG} — NOT "Failed to submit change request. Please try again." No new draft change request is left in the list.`],
    ['PP-04', 'Re-postponement: Approve / Reject visible', 'Vessel: request a RE-postponement on a Postponement-Approved WO; Sync. Office approver: Work Orders list → open the WO (status "Awaiting Office Approval") → review popup.', 'Approve and Reject buttons are shown. Approve: the new date is applied, WO "Postponement Approved". On a second re-postponement, Reject: the WO returns to the previous approved postponement. Same buttons work from the Dashboard postponement popup.'],
    ['AP-04', 'Re-postponement history', 'After PP-04, open the WO form / postpone dialog (office and, after Sync, vessel).', '"Approval process" → Re-Postponement: "Requested" by the vessel user (name + rank, date + time), then "Approved — <step name>" / "Rejected — <step name>" by the approver.'],
    ['WD-01', 'Withdraw button in Modify PMS', 'Send a NEW change request (after this build). Open it in Modify PMS (change request dialog) as the sender, then as anyone else.', 'The sender sees "Withdraw request" in the Modify PMS dialog (not only in the WO postponement popup). Nobody else sees it.'],
    ['WD-02', 'Withdraw a CR in the office', 'Office sender: Modify PMS → dialog → Withdraw request → reason → Withdraw.', 'Message "Request withdrawn — the approvers have been told." CR back to Draft; reopening shows "Withdrawn by <name> on <date>" and the reason; approver gets a bell notification.'],
    ['WD-03', 'Withdraw a CR on the vessel', 'Vessel sender withdraws a pending CR in Modify PMS.', '"Withdrawal sent — the office cancels the request when this reaches shore by sync." CR still pending on board.'],
    ['WD-04', '… after sync', 'Sync the vessel (twice if needed).', 'Office: request cancelled automatically; CR Draft; approver notified. Vessel after next Sync: CR Draft, "Withdrawn by …".'],
    ['WD-05', 'Too late', 'Vessel sender withdraws a pending CR, but BEFORE the vessel syncs the approver approves it in the office. Sync twice.', 'The approval stands. Vessel note: "Withdrawal too late … the decision stands."'],
    ['WD-06', 'Withdraw a WO postponement', 'Vessel sender: WO postpone dialog (Awaiting Office Approval) → Withdraw request; Sync.', 'WO keeps its ORIGINAL due date; approver notified; vessel shows the same after Sync. (Passed in Round 2 — confirm still OK.)'],
    ['DF-06', 'Closure blocked while an extension is pending — ON THE VESSEL', 'Vessel: 2nd Engineer requests a target date extension (Part B5). Do NOT wait for the office. Master opens Part C1 and tries to close out. Repeat after Sync while the extension is still pending in the office.', 'Closeout is refused: "This defect has a pending extension approval; complete that approval before closing the defect." (both before and after Sync). After the office approves/rejects and the vessel syncs, closeout is allowed.'],
    ['DF-09', 'Closure evidence attachments', 'Master: Part C1 → "Attachment(s)" button → upload a file → tick it under "Closure evidence" → complete closeout → Save. Then try to remove that file.', 'C1 has its own Attachment(s) button and a "Closure evidence" tick list of the defect\'s files. The ticked file is saved as closure evidence. After closing, removing it is refused ("Closure evidence cannot be removed once the defect is closed…").'],
    ['PDF-01', 'Defect PDF — all extensions', 'Open a defect with two or more extensions → Export (top right of the defect form).', 'A PDF downloads. Every extension is printed with its status. (Please note in Remarks which screen\'s Export button you used.)'],
    ['PDF-02', 'Rejected closures — setting OFF', 'Defect with a returned verification; setting "Show rejected closure attempts…" OFF → Export.', 'PDF downloads without the rejected closure attempts.'],
    ['PDF-03', 'Rejected closures — setting ON', 'Turn the setting ON (Admin → Approval Workflow → Defects); Export again.', 'PDF lists the rejected closure attempts (who, when, reason).'],
    ['DG-06', 'Failed update + Apply again (clearer steps)', 'BACKEND-ASSISTED — ask Ghazi to prepare: one approval that finished but whose record did not update. Then open Admin → Approval Workflow → "Approval diagnostics" → View details.', 'The item is listed under "Approvals finished but the record was not updated" with an "Apply again" button. As the VIEW-only user: refused. As Sail Admin: "Applied.", the row disappears and the record shows the decision.'],
    ['DG-08', 'Defects diagnostics (clearer expected result)', 'Remove the approver from the Defects Extension chain\'s vessel (or leave Defects Verification without a chain), then open Admin → Approval Workflow and look at the SECOND box "Defects approval diagnostics" → View details.', 'The box shows red chips for what is wrong (e.g. a step not set up, a vessel with nobody to approve). "View details" opens a pop-up listing each item with what to do. When everything is set up it shows no problems.'],
  ]},
  { name: '3. Jeevan — bug fixes', cases: [
    ['JB-01', 'Office user\'s title in history (#3)', 'Office user (no rank, e.g. Jeevan) approves a change request / postponement. Open the "Approval process" section.', 'Shows the office user\'s job title (designation) or role — e.g. "Jeevan Naik (Technical Officer)" — NOT "(Chief Engineer)". Vessel users still show their rank.'],
    ['JB-02', 'Configured approvers visible to other users (#13)', 'Log in as a user who can open Admin → Approval Workflow but is not an admin (VIEW-only). Open a classification that has a chain.', 'The "Configured approvers" table lists the approvers — no "⚠ no approver resolved" and no "could not load". If loading really fails it says "could not load the approvers", never "no approver".'],
    ['JB-03', 'Step editor shows the saved chain (#13)', 'Open a classification that has a saved chain.', 'The step editor opens already filled with the saved steps and roles (not empty).'],
    ['JB-04', 'Office can create a defect (#12)', 'In the office, create a new defect and save.', 'Saved without "Failed to create defect"; the number has the office mark "O" (e.g. …-26-O0001).'],
    ['JB-05', 'C2 Verification on the vessel (#8)', 'Vessel: Master closes out a defect; Sync; office approves the verification; Sync. Open the defect on the vessel → C2.', 'Date Verified, Verified By (Name) and (Office Position) are filled on the vessel. No "will be reviewed after the next sync" note under a verified defect.'],
    ['JB-06', 'Extension outcome on the vessel (#7)', 'Vessel requests an extension; Sync; office approves (with comments); Sync. Open the defect on the vessel → B5.', 'The extension shows "Approved on <date>", "Approved via approval workflow by <approver> on <date>" and "Approver comments: …". Repeat with Reject: shows Rejected the same way.'],
  ]},
  { name: '4. Multi-level approvals (Jeevan #14)', cases: [
    ['ML-01', 'Two-step chain end to end', 'Chain: Step 1 = role A, Step 2 = role B (both "all must approve"). Vessel sends a request; Sync. Approver A approves; approver B approves.', 'After A: request still pending, Step 2 active, approver B notified. After B: approved. "Approval progress" shows each step\'s result; history lists both approvals with step names.'],
    ['ML-02', 'Both approvers of one step at the same time (#14c)', 'Chain: ONE step with roles A AND B ("all must approve"). Two approvers click Approve at the same moment (two browsers).', 'The request moves on / is approved. It must NOT stay stuck with both approved and nothing happening.'],
    ['ML-03', 'A role with nobody on that vessel (#14a)', 'Chain: one step with roles A AND B, where nobody holding role B is assigned to the vessel. Approver A approves.', 'Request waits; diagnostics show "a role nobody holds". Sail Admin sees an Approve button on that request and can approve the empty place; the request then completes. (Sail Admin does NOT get the button while someone else can still approve.)'],
    ['ML-04', 'One person, two roles (decision D3)', 'User (g) holds BOTH roles of an "all must approve" step. User (g) approves.', 'User (g) can approve only once. After that, (g) no longer sees Approve; the second place needs a different person. If nobody else holds that role, Sail Admin can complete it (as in ML-03).'],
    ['ML-05', 'Progress stays after the decision (#14e)', 'After a request is approved, reopen it (Modify PMS dialog, postponement popup).', '"Approval progress — Approved" is still shown with each step (it used to disappear).'],
    ['ML-07', 'Approver changes a value in a two-step chain', 'Two-step chain for a Spare change request. Step 1 approver opens the request, changes the proposed value (e.g. 100 → 80) and approves. Step 2 approver approves without changing it. Repeat with BOTH approvers changing the value.', 'First run: the spare gets the step-1 value (80), not the requested one. Second run: the value of the final (step-2) approver wins.'],
    ['ML-06', 'Ship postponement shows the real sender (#14g)', 'Vessel user (d) requests a postponement; Sync. Office opens it.', 'The request shows the vessel user as the sender (not "Office"); the history "Requested" line has their name and rank.'],
  ]},
  { name: '5. Jeevan — enhancements', cases: [
    ['EN-01', 'Only the current version (#1)', 'Save a chain twice (v1, v2). Open it.', 'Versions shows only v2 (active) with "Show history (1)". Click it: v1 (superseded) appears; "Hide history" hides it.'],
    ['EN-02', 'Approver table with vessels (#2)', 'Open a chain → "Configured approvers".', 'A table: User | Role | Assigned vessels (vessel names). A user with no vessel shows "⚠ no vessel assigned — cannot approve any request".'],
    ['EN-03', 'Dashboard Modify PMS popup (#4)', 'Dashboard → Operation → Modify PMS Requests → open a pending request.', 'The popup shows "Approval progress" (the step and roles) and "Approval process" (Submitted by … with date + time).'],
    ['EN-04', 'Dashboard postponement popup (#5)', 'Dashboard → open a postponement awaiting approval.', 'The popup shows "Approval progress" and "Approval process" (Postponement / Re-Postponement history).'],
    ['EN-05', 'Who requested the extension (#6)', 'Vessel 2nd Engineer requests an extension. Open B5 on the vessel, then in the office after Sync.', 'The extension shows "Submitted by <name> (<rank>) on <date>" on both sides.'],
    ['EN-06', 'Defect approval history (#9)', 'Run an extension (request → approve) and a verification (close out → approve). Open B5 and C2 in the office and, after Sync, on the vessel.', 'B5 and C2 each show an "Approval process" list: Requested / Closed out — sent for verification (by whom, when), then each step\'s Approved / Rejected with the approver and remarks. Same on the vessel. A returned verification starts a new attempt ("Closed out again").'],
    ['EN-07', 'Part A locked after the first save (#10, decision D2)', 'Create a defect, save. Reopen it and try to change Part A (description, dates, component, CoC, attachments).', 'Note "Part A is locked after the first save and cannot be changed."; Part A fields are greyed out; Part A attachments can be viewed but not added/removed. Target Date stays editable (extensions). Saving other parts works normally.'],
    ['EN-08', 'Sail Admin unlock', 'As Sail Admin open the locked defect → Unlock → enter a reason → Unlock Part A. Change the description → Save. Then try to change Part A again.', 'Unlock needs a reason. One Part A change is allowed and saved; then Part A is locked again. Other users never see Unlock.'],
    ['EN-09', 'V-code in the defect number (#11, decision D1)', 'On a vessel that HAS a V-code in master data: create a defect on the vessel and one in the office. On a vessel WITHOUT a V-code: create one.', 'With V-code: vessel "<VCODE>-26-0001" style, office "<VCODE>-26-O0001" style; the running number continues from the year\'s earlier defects. Without V-code: the old format (D###-26-…). Existing defects keep their numbers.'],
  ]},
  { name: '6. Short regression', cases: [
    ['RG-01', 'CR approve / reject', 'Vessel CR → office approves; another → rejects with remarks; Sync.', 'As in Round 2: approved value applied / rejected unchanged, history correct, vessel shows the result.'],
    ['RG-02', 'Postponement approve / reject', 'Vessel postponement → office approves; another → rejects.', 'As in Round 2.'],
    ['RG-03', 'Defect extension + verification', 'Full extension approval and verification approval through the chains.', 'As in Round 2 (target date advanced; verified with approver identity).'],
    ['RG-04', 'Vessel cannot decide', 'On the vessel as Sail Admin, try to approve a pending request.', '"Approval happens in the office…" — refused.'],
    ['RG-05', 'Clean sync', 'After the whole round, Sync twice.', 'Nothing left to send or receive; no sync errors on the Sync Dashboard.'],
  ]},
];

// Shared with the Excel checklist (make_qa_xlsx_approvals_round3.cjs) so both files always say the same.
const TITLE = 'QA Test Cases — Approval Workflow (Round 3): Round 2 re-tests, Jeevan\'s bugs, multi-level approvals, enhancements';
const SCOPE = [
  '1. Re-test of everything that FAILED or PARTLY PASSED in Round 2 (CR-01, PP-04, AP-04, WD-01…06, DF-06, DF-09, PDF-01…03) and clearer steps for DG-06 / DG-08.',
  '2. Jeevan\'s bug points: office title in history, configured approvers for non-admins, step editor, office defect creation, verification and extension results on the vessel.',
  '3. Multi-level approvals: two-step chains, two approvers at once, a role with nobody on the vessel, one person with two roles, progress after the decision, ship postponement sender.',
  '4. Jeevan\'s enhancements: current version only, approver table with vessels, Dashboard popups, extension submitter, defect approval history, Part A lock with Sail Admin unlock, V-code in the defect number.',
  '5. A short regression of the main Round 2 flows.',
];
const INTENTIONAL = [
  '• The vessel never approves: approvals happen in the office and reach the vessel by sync.',
  '• One person cannot fill two places of the same "all must approve" step (decision D3) — a second person is needed.',
  '• Part A is locked for everyone after the first save; only Sail Admin can unlock, with a reason, for ONE change (decision D2). Target Date is not part of the lock.',
  '• Defect numbers use the V-code only when the vessel has one in master data; old defects keep their numbers (decision D1).',
  '• Change requests sent BEFORE this build cannot be withdrawn (no sender was recorded).',
  '• Older records show "Not Recorded" where a name or time was never saved.',
  '• Times are shown in UTC with a "Z" (e.g. 23 Oct 2026, 0718 Z).',
  '• Defects → Reports page shows "Coming soon" — the reports are not defined yet (waiting for requirements). Test PDF export from the defect form and the Defect Log.',
];
const KNOWN_ISSUES = [
  '• Office history rows written before this build may still say "(Chief Engineer)" for office users — only new rows are corrected.',
];
module.exports.TEXTS = { TITLE, SCOPE, INTENTIONAL, KNOWN_ISSUES, DATE };

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
  return new TableRow({ cantSplit: true, children: cells.map((ch, i) => new TableCell({
    width: { size: W[i], type: WidthType.DXA }, borders: CELL_BORDERS,
    children: [new Paragraph({ children: ch, spacing: { after: 40 } })],
  })) });
}

module.exports.AREAS = AREAS;
if (require.main !== module) return;

const total = AREAS.reduce((n, a) => n + a.cases.length, 0);
const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [run(TITLE, { size: 32, bold: true })], spacing: { after: 120 } }),
  para(`Branch: feature/approval-engine-phase2   ·   Build: ${BUILD}   ·   Date: ${DATE}   ·   ${total} test cases`, { run: { italics: true, size: 20 } }),
  h1('Scope of this round'),
  ...SCOPE.map((t) => para(t)),
  h1('Known intentional behaviour — do NOT log as a defect'),
  ...INTENTIONAL.map((t) => para(t)),
  h1('Known issues — already reported'),
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
  fs.writeFileSync('docs/output/QA-TESTCASES-Approval-Workflow-Round3.docx', buf);
  console.log(`docx written, ${total} cases`);
});
