// QA checklist (Excel) — Job Form "Work Instructions" (PDF attachments on Jobs), 25-Oct-2026.
// Run from the repo root: node local-test-env/make_qa_xlsx_work_instructions.cjs → docs/output/QA-TESTCASES-Job-Work-Instructions.xlsx
// Same layout as the Approval Workflow packs (Read Me · Test Cases · Summary). Build = the commit it is generated from.
const fs = require('fs');
const BUILD = process.env.QA_BUILD || require('child_process').execSync('git rev-parse --short HEAD').toString().trim();
const BRANCH = process.env.QA_BRANCH || 'replit_dev';
const ExcelJS = require('exceljs');

const TITLE = 'QA Test Cases — Job Form: Work Instructions (PDF attachments on Jobs)';
const SCOPE = [
  'Office users attach PDF "Work Instructions" to a Vessel Job from the Job form: upload a new PDF or attach a PDF already uploaded for the vessel.',
  'One PDF can be attached to many Jobs of the same vessel. Removing takes it off that Job only; removed ones can be shown and restored.',
  'Work Orders show the Work Instructions of their Job (read-only, always the current list).',
  'Ships receive the PDFs by sync and can open them; ships cannot upload, attach or remove (office-managed).',
  'Jobs bulk import: new last column "Job attachments" in the Vessel_Job sheet — PDF file names (;-separated) of PDFs already uploaded for the vessel.',
  'Admin → Bulk Upload → Jobs: a "Work Instruction PDFs" box uploads many PDFs for the vessel in one go (not attached to any Job yet) so the Jobs sheet can name them.',
];
const INTENTIONAL = [
  'Ship installation: Upload / Attach existing / Remove / Restore are not offered; a note says Work Instructions are managed in the office. This is by design.',
  'Removed Work Instructions are never deleted — "Show removed" lists them and they can be restored. By design (no purge).',
  'One active PDF NAME per vessel: uploading a file with the same name again is refused with a message offering "Attach existing". Upload a revision under a new name (e.g. "…_Rev2.pdf").',
  'Bulk import takes file NAMES only — never file paths and never the PDF itself. The PDF must be uploaded first — through the Job form or the multi-file box on the Bulk Upload → Jobs page.',
  'Multi-file upload judges every file on its own: uploaded / skipped (name already exists for the vessel) / refused (not a PDF). One file over 25 MB stops the whole batch with a message — remove it and upload the rest again.',
  'Fleet Jobs (Fleet → Jobs) have no Work Instructions — the requirement covers Vessel Jobs only.',
  'Maximum PDF size 25 MB; only real PDF files (a Word file renamed to .pdf is refused).',
];
const KNOWN = [
  'A ship still on the OLD build while the office is already on this build was not tested — install office and ships on the same build.',
];
const AREAS = [
  { name: '1. Setup & Prerequisites', pre: 'None', cases: [
    ['SET-01', 'Test server on the new build', `Office (shore) server and at least one vessel installation run build ${BUILD} (branch ${BRANCH}). Server restarted after deploy.`, 'Server starts without errors; database update 183 (job_work_instruction_files / job_work_instruction_links) applied automatically.'],
    ['SET-02', 'Vessel installation provisioned and synced', 'Provision (or re-provision) the test vessel from the office server and run Sync Now once.', 'Sync completes with nothing left to send or receive.'],
    ['SET-03', 'Test users', 'Prepare: (a) an office user with Modify PMS EDIT permission (edits Jobs); (b) an office user with VIEW only on Modify PMS; (c) a vessel user (e.g. 2nd Engineer) on the vessel installation.', 'All users can log in.'],
    ['SET-04', 'Test files', 'Prepare: (a) two small real PDFs, e.g. Pump_Overhaul.pdf and Valve_Check.pdf; (b) a Word or text file; (c) a Word file RENAMED to .pdf; (d) a PDF larger than 25 MB.', 'Files ready on the tester PC.'],
    ['SET-05', 'Two Vessel Jobs', 'Pick two existing Vessel Jobs of the test vessel (Job A, Job B) that have at least one open Work Order each. Note their Job numbers.', 'Jobs and their Work Orders open normally.'],
  ]},
  { name: '2. Job form — upload and attach (office)', pre: 'SET-01…SET-05 done; office EDIT user', cases: [
    ['WI-01', 'Button on the Job form', 'Office: open Job A (Modify / Edit mode).', 'A "Work Instructions" button is visible on the Job form. Clicking it opens the Work Instructions dialog with an empty list, "Upload PDF" and "Attach existing".'],
    ['WI-02', 'Upload a PDF with a remark', 'In the dialog type Revision remarks "Rev 1" and upload Pump_Overhaul.pdf.', 'The PDF appears in the list with its name, size, uploaded by (your name), date and the remark "Rev 1".'],
    ['WI-03', 'Open the PDF', 'Click the file name / View on the uploaded row.', 'The PDF opens in a new browser tab and displays correctly.'],
    ['WI-04', 'Download the PDF', 'Click Download on the row.', 'The browser downloads Pump_Overhaul.pdf; the file opens in a PDF reader.'],
    ['WI-05', 'Non-PDF refused', 'Try to upload the Word / text file from SET-04 (b).', 'Refused with a clear message that only PDF files are accepted. Nothing is added to the list.'],
    ['WI-06', 'Renamed file refused', 'Try to upload the Word file renamed to .pdf (SET-04 c).', 'Refused ("not a valid PDF"). Nothing is added.'],
    ['WI-07', 'Oversize refused', 'Try to upload the PDF larger than 25 MB (SET-04 d).', 'Refused with a size message (maximum 25 MB). Nothing is added.'],
    ['WI-08', 'Same name again', 'On Job B, upload a file named Pump_Overhaul.pdf again.', 'Refused: message says a Work Instruction with this name already exists for the vessel and suggests "Attach existing" (or a new name for a revision).'],
    ['WI-09', 'Attach existing to another Job', 'On Job B click "Attach existing", pick Pump_Overhaul.pdf, Attach.', 'Pump_Overhaul.pdf is now listed on Job B too. The picker showed only this vessel\'s uploaded PDFs.'],
    ['WI-10', 'Attach the same file twice', 'On Job B click "Attach existing" and pick Pump_Overhaul.pdf again.', 'Refused / not offered — a Job cannot have the same PDF attached twice.'],
    ['WI-11', 'Second PDF on one Job', 'On Job A upload Valve_Check.pdf.', 'Job A lists two PDFs (Pump_Overhaul.pdf, Valve_Check.pdf).'],
    ['WI-12', 'Remove from one Job only', 'On Job A remove Pump_Overhaul.pdf. Then open Job B.', 'Job A no longer lists Pump_Overhaul.pdf. Job B STILL lists it (removing affects only that Job).'],
    ['WI-13', 'Show removed and restore', 'On Job A tick "Show removed"; click Restore on Pump_Overhaul.pdf.', 'The removed row is shown greyed with the removed-by / date; after Restore it is active again on Job A.'],
    ['WI-14', 'View-only office user', 'Log in as the office VIEW-only user (SET-03 b); open Job A → Work Instructions.', 'The list and View / Download work; Upload, Attach existing, Remove and Restore are not available (or are refused with a permission message).'],
    ['WI-15', 'New Job not yet saved', 'Office: start a NEW Vessel Job (do not save) and click Work Instructions.', 'A note asks to save the Job first before adding Work Instructions. No error.'],
    ['WI-16', 'Job form in view mode', 'Open Job A in view (read-only) mode → Work Instructions.', 'List, View and Download only; no editing buttons.'],
  ]},
  { name: '3. Work Order form (office)', pre: 'Section 2 done (Job A has 2 PDFs)', cases: [
    ['WO-01', 'WO shows the Job\'s Work Instructions', 'Office: open an open Work Order of Job A → Work Instructions.', 'The two PDFs of Job A are listed read-only (no Upload / Attach / Remove).'],
    ['WO-02', 'Open from the WO', 'Click View on a row.', 'PDF opens in a new tab.'],
    ['WO-03', 'Live list', 'On Job A remove Valve_Check.pdf. Re-open the same Work Order → Work Instructions.', 'The WO now shows only Pump_Overhaul.pdf — the WO always shows the Job\'s CURRENT Work Instructions. Restore Valve_Check.pdf afterwards.'],
    ['WO-04', 'Completed WO', 'Open a completed Work Order of Job A → Work Instructions.', 'Same current list, read-only.'],
  ]},
  { name: '4. Vessel installation (ship)', pre: 'Sections 2–3 done; vessel synced after them', cases: [
    ['SH-01', 'Sync brings the list', 'Run Sync Now on the vessel. Open Job A → Work Instructions.', 'Job A lists the same PDFs as in the office (names, remarks, uploaded by).'],
    ['SH-02', 'Ship opens the PDF', 'On the vessel click View / Download on Pump_Overhaul.pdf.', 'The PDF opens / downloads on the vessel — the file itself has reached the ship, not only the list entry.'],
    ['SH-03', 'Ship WO shows them', 'On the vessel open a Work Order of Job A → Work Instructions.', 'Same read-only list; PDF opens.'],
    ['SH-04', 'Ship cannot manage', 'On the vessel open Job A in edit mode → Work Instructions.', 'No Upload / Attach / Remove / Restore; a note says Work Instructions are managed in the office.'],
    ['SH-05', 'Office removal reaches the ship', 'Office: remove Pump_Overhaul.pdf from Job B. Sync the vessel. Vessel: open Job B and Job A.', 'Job B no longer lists it on the vessel; Job A still does.'],
    ['SH-06', 'Office restore reaches the ship', 'Office: Show removed → Restore it on Job B. Sync. Vessel: open Job B.', 'Pump_Overhaul.pdf is back on Job B on the vessel.'],
    ['SH-07', 'Fresh provisioning carries the PDFs (BACKEND-ASSISTED)', 'Developer: re-provision the test vessel installation from the office server (fresh database), then Sync Now once.', 'After the first sync the vessel lists the Work Instructions on Job A / Job B and can OPEN the PDFs.'],
  ]},
  { name: '5. Bulk Upload → Jobs — "Work Instruction PDFs" multi-file box', pre: 'SET-01…SET-04 done; office EDIT user; vessel selected on the Bulk Upload page', cases: [
    ['MU-01', 'Box is on the Jobs bulk upload page', 'Admin → Bulk Upload → select the test vessel → Jobs.', 'Above the Jobs upload a box "Work Instruction PDFs (for the Jobs import)" with a file chooser (multiple), an optional remarks field and an Upload button. Without a vessel selected it says "Select a vessel first".'],
    ['MU-02', 'Upload several PDFs at once', 'Pick 3 new PDFs (e.g. Gen_Overhaul.pdf, Purifier_Clean.pdf, Boiler_Survey.pdf), remarks "Batch 1", Upload.', 'Result "Uploaded 3 · Skipped 0 · Refused 0" with the three names. Job form → Attach existing on any Job of the vessel now offers the three files (not attached to any Job yet).'],
    ['MU-03', 'Mixed batch: existing name and a non-PDF', 'Pick Gen_Overhaul.pdf again, a Word/text file and one new PDF; Upload.', 'Result: Uploaded 1; Skipped Gen_Overhaul.pdf — "already exists for the vessel"; Refused the Word/text file — not a PDF. The new PDF is stored.'],
    ['MU-04', 'Oversize file in the batch', 'Pick one PDF over 25 MB together with a small PDF; Upload.', 'Red message: one of the files is larger than 25 MB — remove it and upload again. Nothing from this batch is stored.'],
    ['MU-05', 'Then attach by sheet', 'Download the Jobs template; for Job A put "Gen_Overhaul.pdf; Boiler_Survey.pdf" in Job attachments; preview, import.', 'Both PDFs attached to Job A (Job form → Work Instructions lists them).'],
    ['MU-06', 'View-only user / ship', 'Open the Bulk Upload → Jobs page as the VIEW-only office user; then on the vessel installation.', 'Office VIEW-only: Upload is refused with a permission message. Vessel: the box says Work Instructions are managed in the office.'],
  ]},
  { name: '6. Jobs bulk import — "Job attachments" column', pre: 'Sections 2 and 5 done (PDFs exist for the vessel); office EDIT user', cases: [
    ['BI-01', 'Template has the column', 'Admin → Bulk Upload → Jobs → download the Jobs template for the test vessel.', 'The Vessel_Job sheet has a last column "Job attachments" (after the Part A columns). Old templates without it still import.'],
    ['BI-02', 'Attach by name through import', 'Fill one row for Job A (its Job Code / Component Code / title etc.) with Job attachments = "Valve_Check.pdf". Mode Update. Preview, then Import.', 'Preview: row OK. Import: Job A updated; result line says "Work Instructions attached: Valve_Check.pdf" (if it was not already attached). Job A → Work Instructions lists it.'],
    ['BI-03', 'Two names', 'Row for Job B with Job attachments = "Pump_Overhaul.pdf; Valve_Check.pdf". Preview, Import.', 'Both PDFs are listed on Job B after import (ones already attached are not duplicated).'],
    ['BI-04', 'Unknown name rejects the row', 'Row for Job A with Job attachments = "Missing.pdf" plus a correct row for Job B. Preview.', 'Preview shows Job A\'s row as an ERROR naming the file: "Job attachment \\"Missing.pdf\\" was not found among this vessel\'s Work Instruction files. Upload it first…". Job B\'s row is OK. Importing the valid rows imports Job B only; Job A is not changed.'],
    ['BI-05', 'Re-import = no duplicates', 'Import the BI-03 sheet a second time.', 'Job B still lists each PDF once; the result does not claim a new attachment.'],
    ['BI-06', 'Blank column', 'Import a row for Job A with the Job attachments cell empty.', 'Job A is imported normally; its existing Work Instructions are unchanged (nothing removed).'],
    ['BI-07', 'Path or non-PDF name refused', 'Row with Job attachments = "C:\\\\docs\\\\Pump_Overhaul.pdf" and another with "notes.txt". Preview.', 'Both rows are errors: "must be a file name, not a path" / "is not a PDF". Nothing imported for them.'],
    ['BI-08', 'Another vessel\'s file', 'Upload a PDF on a Job of a DIFFERENT vessel (e.g. Other_Vessel.pdf). Import a row for Job A of the test vessel with Job attachments = "Other_Vessel.pdf".', 'Row error: not found for this vessel. Work Instructions never cross vessels.'],
  ]},
  { name: '7. Vessel isolation and scope', pre: 'Two vessels with Work Instructions', cases: [
    ['VS-01', 'Picker is vessel-scoped', 'On a Job of vessel 2 click "Attach existing".', 'Only vessel 2\'s PDFs are offered — none of the test vessel\'s files.'],
    ['VS-02', 'Fleet Jobs out of scope', 'Open Fleet → Jobs → a fleet Job.', 'No Work Instructions button (Vessel Jobs only).'],
    ['VS-03', 'Audit information', 'Open Job A → Work Instructions; tick Show removed.', 'Every row shows who uploaded / attached and when; removed rows show who removed and when.'],
  ]},
];
const HIGH = /^(SET-0[1-5]|WI-0[1-2]|WI-0[5-9]|WI-1[0-4]|WO-0[1-3]|SH-0[1-7]|MU-0[1-5]|BI-0[1-5]|VS-01)$/;

const wb = new ExcelJS.Workbook();
const readme = wb.addWorksheet('Read Me');
readme.getColumn(1).width = 118;
const lines = [
  [TITLE, true],
  [`Branch: ${BRANCH}  ·  Build: ${BUILD}  ·  Date: 25-Oct-2026`],
  [''],
  ['SCOPE OF THIS ROUND:', true],
  ...SCOPE.map((t) => [t]),
  [''],
  ['SETUP REQUIRED BEFORE TESTING (Setup section in the Test Cases sheet):', true],
  [`1. Office server and a vessel installation on build ${BUILD}; vessel provisioned from the office and synced once.`],
  ['2. Users: office user with Modify PMS EDIT; office user with VIEW only; one vessel user on the vessel installation.'],
  ['3. Test files: five small PDFs, a Word/text file, a Word file renamed to .pdf, a PDF over 25 MB.'],
  [''],
  ['KNOWN INTENTIONAL BEHAVIOUR — DO NOT LOG AS A DEFECT:', true],
  ...INTENTIONAL.map((t) => [t]),
  [''],
  ['KNOWN LIMITATION — ALREADY RECORDED:', true],
  ...KNOWN.map((t) => [t]),
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
  const areaName = area.name.replace(/^\d+\.\s*/, '');
  for (const [id, title, steps, expected] of area.cases) {
    const row = ws.addRow([id, areaName, title, area.pre, steps, expected, HIGH.test(id) ? 'High' : 'Medium', '', '', '']);
    row.eachCell({ includeEmpty: true }, (c) => { c.alignment = { vertical: 'top', wrapText: true }; c.font = { name: 'Arial', size: 10, bold: c.col === 1 }; });
    total++;
  }
}
ws.autoFilter = { from: 'A1', to: 'J1' };
ws.dataValidations.add(`H2:H${total + 1}`, { type: 'list', allowBlank: true, formulae: ['"PASS,FAIL,BLOCKED,N/A"'] });
ws.addConditionalFormatting({ ref: `H2:H${total + 1}`, rules: [
  { type: 'cellIs', operator: 'equal', formulae: ['"PASS"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD1FADF' } } } },
  { type: 'cellIs', operator: 'equal', formulae: ['"FAIL"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE4E2' } } } },
  { type: 'cellIs', operator: 'equal', formulae: ['"BLOCKED"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEF0C7' } } } },
] });

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
wb.xlsx.writeFile('docs/output/QA-TESTCASES-Job-Work-Instructions.xlsx').then(() => console.log(`xlsx written, ${total} cases, build ${BUILD}`));
