// QA test cases (Word) — Job Form "Work Instructions" (PDF attachments on Jobs), 25-Oct-2026. Same layout as the
// Approval Workflow round-3 docx; the cases and texts come from make_qa_xlsx_work_instructions.cjs (one source).
// Run from the repo root: node local-test-env/make_qa_docx_work_instructions.cjs → docs/output/QA-TESTCASES-Job-Work-Instructions.docx
// (then move it to C:\Users\GhaziAnwer\QA sheets\ — QA packs are kept outside the repo).
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, ShadingType, BorderStyle, PageOrientation,
} = require('docx');
const fs = require('fs');
const { AREAS, TITLE, SCOPE, INTENTIONAL, KNOWN, BUILD, BRANCH } = require('./make_qa_xlsx_work_instructions.cjs');
const DATE = '25-Oct-2026';

const FONT = 'Arial';
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 20, ...o });
const para = (t, o = {}) => new Paragraph({ children: [run(t, o.run || {})], spacing: { after: 120 }, ...o.p });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(t, { bold: true, size: 26, color: '1F4E79' })], spacing: { before: 240, after: 120 } });

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
function caseRow([id, title, steps, exp], pre) {
  const stepCell = [new Paragraph({ children: [run(steps)], spacing: { after: 40 } })];
  if (pre && pre !== 'None') stepCell.push(new Paragraph({ children: [run(`Preconditions: ${pre}`, { italics: true, size: 18, color: '595959' })], spacing: { after: 40 } }));
  const cells = [[new Paragraph({ children: [run(id, { bold: true })], spacing: { after: 40 } })], [new Paragraph({ children: [run(title)], spacing: { after: 40 } })], stepCell, [new Paragraph({ children: [run(exp)], spacing: { after: 40 } })], [new Paragraph({ children: [run('')] })]];
  return new TableRow({ cantSplit: true, children: cells.map((ch, i) => new TableCell({ width: { size: W[i], type: WidthType.DXA }, borders: CELL_BORDERS, children: ch })) });
}

const total = AREAS.reduce((n, a) => n + a.cases.length, 0);
const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [run(TITLE, { size: 32, bold: true })], spacing: { after: 120 } }),
  para(`Branch: ${BRANCH}   ·   Build: ${BUILD}   ·   Date: ${DATE}   ·   ${total} test cases`, { run: { italics: true, size: 20 } }),
  h1('Scope of this round'),
  ...SCOPE.map((t) => para('• ' + t)),
  h1('Setup required before testing'),
  para(`• Office server and a vessel installation on build ${BUILD}; vessel provisioned from the office and synced once.`),
  para('• Users: office user with Modify PMS EDIT; office user with VIEW only; one vessel user on the vessel installation.'),
  para('• Test files: five small PDFs, a Word/text file, a Word file renamed to .pdf, a PDF over 25 MB.'),
  h1('Known intentional behaviour — do NOT log as a defect'),
  ...INTENTIONAL.map((t) => para('• ' + t)),
  h1('Known limitation — already recorded'),
  ...KNOWN.map((t) => para('• ' + t)),
  h1('How to record results'),
  para('Write Pass or Fail in the last column. For every Fail give: TC ID, user and role, vessel, office or vessel installation, time, a screenshot, and the exact message shown. BACKEND-ASSISTED cases need a developer to prepare the state.'),
];
for (const area of AREAS) {
  children.push(h1(area.name));
  children.push(new Table({ width: { size: 14400, type: WidthType.DXA }, columnWidths: W, rows: [headerRow(), ...area.cases.map((c) => caseRow(c, area.pre))] }));
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
  fs.writeFileSync('docs/output/QA-TESTCASES-Job-Work-Instructions.docx', buf);
  console.log(`docx written, ${total} cases, build ${BUILD}`);
});
