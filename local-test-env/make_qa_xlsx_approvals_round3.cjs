// QA checklist (Excel) — Approval Workflow round 3 (23-Oct-2026; build = the commit it is generated from).
// Run from the repo root: node local-test-env/make_qa_xlsx_approvals_round3.cjs → docs/output/QA-TESTCASES-Approval-Workflow-Round3.xlsx
// Same cases as the Word document (make_qa_docx_approvals_round3.cjs); same layout as the Round 2 sheet.
const fs = require('fs');
// The build under test: the commit the pack is generated from (override with QA_BUILD).
const BUILD = process.env.QA_BUILD || require('child_process').execSync('git rev-parse --short HEAD').toString().trim();
const ExcelJS = require('exceljs');
const { AREAS, TEXTS } = require('./make_qa_docx_approvals_round3.cjs');

const PRECONDITION = {
  '1': 'None',
  '2': 'SET-01…SET-04 done; Round 2 result in Remarks of Round 2 sheet',
  '3': 'SET-01…SET-04 done; vessel synced',
  '4': 'SET-01…SET-04 done; chains as stated in the case',
  '5': 'SET-01…SET-04 done',
  '6': 'Sections 2–5 done',
};
// Everything that failed / partly passed in Round 2 and every multi-level case is High.
const HIGH = /^(SET-0[1-4]|CR-01|PP-04|AP-04|WD-0[1-6]|DF-0[69]|PDF-0[1-3]|JB-0[1-6]|ML-0[1-6]|EN-0[6-9]|RG-05)$/;

const wb = new ExcelJS.Workbook();
const readme = wb.addWorksheet('Read Me');
readme.getColumn(1).width = 118;
const lines = [
  [TEXTS.TITLE, true],
  [`Branch: replit_dev  ·  Build: ${BUILD}  ·  Date: ${TEXTS.DATE}`],
  [''],
  ['SCOPE OF THIS ROUND:', true],
  ...TEXTS.SCOPE.map((t) => [t]),
  [''],
  ['SETUP REQUIRED BEFORE TESTING (Setup section in the Test Cases sheet):', true],
  [`1. Office server AND the vessel installation on build ${BUILD}; vessel synced once.`],
  ['2. Same users as Round 2, plus: an office user holding TWO approver roles (ML-04) and a VIEW-only Approval Workflow user (JB-02).'],
  ['3. Chains set up in Admin → Approval Workflow as listed in SET-04 (and the two-step chain for ML-01).'],
  ['4. EN-09 needs one vessel WITH a V-code in master data and one WITHOUT.'],
  [''],
  ['KNOWN INTENTIONAL BEHAVIOUR — DO NOT LOG AS A DEFECT:', true],
  ...TEXTS.INTENTIONAL.map((t) => [t]),
  [''],
  ['KNOWN ISSUES — ALREADY REPORTED:', true],
  ...TEXTS.KNOWN_ISSUES.map((t) => [t]),
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
    total++;
  }
}
ws.autoFilter = { from: 'A1', to: 'J1' };
// One Status dropdown for the whole column (per-cell rules were merged into overlapping ranges,
// which Excel can report as a problem and offer to repair).
ws.dataValidations.add(`H2:H${total + 1}`, { type: 'list', allowBlank: true, formulae: ['"PASS,FAIL,BLOCKED,N/A"'] });
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
wb.xlsx.writeFile('docs/output/QA-TESTCASES-Approval-Workflow-Round3.xlsx').then(() => console.log(`xlsx written, ${total} cases`));
