// QA checklist (Excel) — Approval Workflow round 2 (28-Sep-2026, build 8b8237c25).
// Run from the repo root: node local-test-env/make_qa_xlsx_approvals_round2.cjs → docs/output/QA-TESTCASES-Approval-Workflow-Round2.xlsx
// Same cases as the Word document (make_qa_docx_approvals_round2.cjs); same layout as the 04-Sep sheet.
const fs = require('fs');
const ExcelJS = require('exceljs');
const { AREAS } = require('./make_qa_docx_approvals_round2.cjs');

const PRECONDITION = {
  '1': 'None',
  '2': 'SET-01…SET-04 done; Admin (office) login',
  '3': 'Section 2 done; Admin (office) login',
  '4': 'SET-01…SET-04 done; chain set up where stated (AW-04)',
  '5': 'SET-01…SET-04 done; WO Postponement / Re-Postponement chains set up',
  '6': 'Chains set up; request sent AFTER this build was installed',
  '7': 'Defects Extension / Verification chains set up; Master user on the vessel',
  '8': 'Defects with approved extensions',
  '9': 'Defect with several extensions / a returned verification',
  '10': 'Chains set up; email settings for NT-03',
  '11': 'Vessel installation provisioned from this office server',
};
const HIGH = /^(SET-0[1-4]|AW-0[1-4]|CR-0[1-7]|PP-0[1-3]|WD-0[1-7]|DF-0[1-8]|ST-0[12]|SY-0[12]|DG-0[1-3])$/;

const wb = new ExcelJS.Workbook();
const readme = wb.addWorksheet('Read Me');
readme.getColumn(1).width = 118;
const lines = [
  ['QA Test Cases — Approval Workflow (Round 2): combined screen, engine-only approvals, withdraw, Defects', true],
  ['Branch: feature/approval-engine-phase2  ·  Build: 8b8237c25  ·  Date: 28-Sep-2026'],
  [''],
  ['SETUP REQUIRED BEFORE TESTING (Setup section in the Test Cases sheet):', true],
  ['1. Office server and a vessel installation on build 8b8237c25; vessel provisioned from the office and synced once.'],
  ['2. Users: Sail Admin; an office approver (role used in the chains) assigned to the test vessel in SAILERP; a second user with'],
  ['   the SAME role NOT assigned; a vessel user who sends requests (e.g. Chief Engineer); a second vessel user; the Master.'],
  ['3. Access Control: Approval Workflow (PMS and Defects) — VIEW + EDIT for the admin/approver role, VIEW only for one other role.'],
  ['4. Approval chains are set up in Admin → Approval Workflow (tests AW-04 onwards).'],
  ['5. Email tests only: AWS_SES_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, APPROVAL_EMAIL_FROM on the office server.'],
  [''],
  ['KNOWN INTENTIONAL BEHAVIOUR — DO NOT LOG AS A DEFECT:', true],
  ['• The vessel never approves: approvals happen in the office and reach the vessel by sync.'],
  ['• A vessel can submit a request even when the office has no chain; it waits in the office until one is set up.'],
  ['• Requests sent before this build cannot be withdrawn (no sender was recorded).'],
  ['• A withdrawal from the vessel takes effect only after sync; if the office decided first, the decision stands ("too late").'],
  ['• Modify PMS change requests in the "Work Orders" category need no approval.'],
  ['• Without email settings on the server, only in-app (bell) notifications are sent.'],
  [''],
  ['Fill the Status column with PASS / FAIL / BLOCKED / N/A. For every FAIL add in Remarks: user + role, vessel, office or vessel', true],
  ['installation, time, and the exact message shown; attach a screenshot. BACKEND-ASSISTED cases need a developer to prepare the data.', true],
];
lines.forEach(([t, bold], i) => {
  const c = readme.getCell(i + 1, 1);
  c.value = t;
  c.font = { name: 'Arial', size: i === 0 ? 14 : 10, bold: !!bold, color: i === 0 ? { argb: 'FF1F4E79' } : undefined };
});

const ws = wb.addWorksheet('Test Cases', { views: [{ state: 'frozen', ySplit: 1 }] });
ws.columns = [
  { header: 'TC ID', width: 9 }, { header: 'Area', width: 22 }, { header: 'Test Case', width: 30 },
  { header: 'Preconditions', width: 28 }, { header: 'Steps', width: 52 }, { header: 'Expected Result', width: 52 },
  { header: 'Priority', width: 9 }, { header: 'Status', width: 11 }, { header: 'Tester / Date', width: 16 }, { header: 'Remarks', width: 30 },
];
ws.getRow(1).eachCell((c) => {
  c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  c.alignment = { vertical: 'middle', wrapText: true };
});
let total = 0;
for (const area of AREAS) {
  const num = area.name.split('.')[0];
  const areaName = area.name.replace(/^\d+\.\s*/, '');
  for (const [id, title, steps, expected] of area.cases) {
    const row = ws.addRow([id, areaName, title, PRECONDITION[num] ?? '', steps, expected, HIGH.test(id) ? 'High' : 'Medium', '', '', '']);
    row.eachCell({ includeEmpty: true }, (c) => { c.alignment = { vertical: 'top', wrapText: true }; c.font = { name: 'Arial', size: 10, bold: c.col === 1 }; });
    row.getCell(8).dataValidation = { type: 'list', allowBlank: true, formulae: ['"PASS,FAIL,BLOCKED,N/A"'] };
    total++;
  }
}
ws.autoFilter = { from: 'A1', to: 'J1' };
ws.addConditionalFormatting({ ref: `H2:H${total + 1}`, rules: [
  { type: 'cellIs', operator: 'equal', formulae: ['"PASS"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD1FADF' } } } },
  { type: 'cellIs', operator: 'equal', formulae: ['"FAIL"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE4E2' } } } },
  { type: 'cellIs', operator: 'equal', formulae: ['"BLOCKED"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEF0C7' } } } },
] });

// Summary sheet: live counts per area from the Status column.
const sum = wb.addWorksheet('Summary');
sum.columns = [{ header: 'Area', width: 44 }, { header: 'Cases', width: 8 }, { header: 'PASS', width: 8 }, { header: 'FAIL', width: 8 }, { header: 'BLOCKED', width: 10 }, { header: 'Not run', width: 9 }];
sum.getRow(1).eachCell((c) => { c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; });
const last = total + 1;
const areaNames = AREAS.map((a) => a.name.replace(/^\d+\.\s*/, ''));
areaNames.forEach((name, i) => {
  const r = i + 2;
  const q = `'Test Cases'!$B$2:$B$${last}`; const s = `'Test Cases'!$H$2:$H$${last}`;
  sum.addRow([name,
    { formula: `COUNTIF(${q},A${r})` },
    { formula: `COUNTIFS(${q},A${r},${s},"PASS")` },
    { formula: `COUNTIFS(${q},A${r},${s},"FAIL")` },
    { formula: `COUNTIFS(${q},A${r},${s},"BLOCKED")` },
    { formula: `B${r}-C${r}-D${r}-E${r}-COUNTIFS(${q},A${r},${s},"N/A")` }]);
});
const tr = areaNames.length + 2;
sum.addRow(['TOTAL', { formula: `SUM(B2:B${tr - 1})` }, { formula: `SUM(C2:C${tr - 1})` }, { formula: `SUM(D2:D${tr - 1})` }, { formula: `SUM(E2:E${tr - 1})` }, { formula: `SUM(F2:F${tr - 1})` }]).font = { bold: true };

fs.mkdirSync('docs/output', { recursive: true });
wb.xlsx.writeFile('docs/output/QA-TESTCASES-Approval-Workflow-Round2.xlsx').then(() => console.log(`xlsx written, ${total} cases`));
