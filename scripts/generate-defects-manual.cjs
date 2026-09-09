const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageBreak, TableOfContents, StyleLevel, LevelFormat, convertInchesToTwip,
  PageOrientation, Header, Footer, PageNumber, NumberFormat
} = require('docx');
const fs = require('fs');
const path = require('path');

const DARK_BLUE = '1e3a5f';
const MED_BLUE = '2563EB';
const LIGHT_BLUE_BG = 'EFF6FF';
const HEADER_BG = '1e3a5f';
const ROW_ALT = 'F1F5F9';
const BORDER_COLOR = 'CBD5E1';
const GREEN = '16a34a';
const RED = 'dc2626';
const ORANGE = 'f97316';
const GREY = '6b7280';

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    children: [new TextRun({ text, color: DARK_BLUE, bold: true, size: 36 })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, color: MED_BLUE, bold: true, size: 28 })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, color: DARK_BLUE, bold: true, size: 24 })],
  });
}

function h4(text) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, color: '374151' })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    children: [new TextRun({ text, size: 20, color: '1f2937', ...opts })],
  });
}

function note(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: convertInchesToTwip(0.3) },
    shading: { type: ShadingType.CLEAR, fill: LIGHT_BLUE_BG },
    children: [
      new TextRun({ text: 'ℹ  ', bold: true, color: MED_BLUE, size: 20 }),
      new TextRun({ text, italics: true, size: 20, color: '1e3a5f' }),
    ],
  });
}

function warning(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: convertInchesToTwip(0.3) },
    shading: { type: ShadingType.CLEAR, fill: 'FFF7ED' },
    children: [
      new TextRun({ text: '⚠  ', bold: true, color: 'ea580c', size: 20 }),
      new TextRun({ text, italics: true, size: 20, color: '92400e' }),
    ],
  });
}

function bullet(text, bold_prefix = '') {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: convertInchesToTwip(0.4), hanging: convertInchesToTwip(0.2) },
    children: [
      new TextRun({ text: '•  ', color: MED_BLUE, size: 20 }),
      bold_prefix ? new TextRun({ text: bold_prefix, bold: true, size: 20, color: '1f2937' }) : null,
      new TextRun({ text, size: 20, color: '374151' }),
    ].filter(Boolean),
  });
}

function step(num, text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    indent: { left: convertInchesToTwip(0.4), hanging: convertInchesToTwip(0.3) },
    children: [
      new TextRun({ text: `${num}.  `, bold: true, color: MED_BLUE, size: 20 }),
      new TextRun({ text, size: 20, color: '374151' }),
    ],
  });
}

function spacer(before = 120) {
  return new Paragraph({ spacing: { before, after: 0 }, children: [new TextRun('')] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function cellBorder(color = BORDER_COLOR) {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}

function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: HEADER_BG },
    borders: cellBorder('FFFFFF'),
    children: [new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18 })],
    })],
  });
}

function dataCell(text, width, bold = false, color = '1f2937', bg = 'FFFFFF') {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: bg },
    borders: cellBorder(BORDER_COLOR),
    children: [new Paragraph({
      spacing: { before: 70, after: 70 },
      children: [new TextRun({ text: text || '', bold, color, size: 19 })],
    })],
  });
}

function table2col(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => headerCell(h, i === 0 ? 35 : 65)),
  });
  const dataRows = rows.map((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFF' : ROW_ALT;
    return new TableRow({
      children: row.map((cell, ci) => {
        const isBold = ci === 0;
        return dataCell(cell, ci === 0 ? 35 : 65, isBold, '1f2937', bg);
      }),
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

function table3col(headers, rows, widths = [30, 20, 50]) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => headerCell(h, widths[i])),
  });
  const dataRows = rows.map((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFF' : ROW_ALT;
    return new TableRow({
      children: row.map((cell, ci) => dataCell(cell, widths[ci], ci === 0, '1f2937', bg)),
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

function table4col(headers, rows, widths = [25, 25, 25, 25]) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => headerCell(h, widths[i])),
  });
  const dataRows = rows.map((row, ri) => {
    const bg = ri % 2 === 0 ? 'FFFFFF' : ROW_ALT;
    return new TableRow({
      children: row.map((cell, ci) => dataCell(cell, widths[ci], ci === 0, '1f2937', bg)),
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

// ─────────────────────────────────────────────
//  DOCUMENT CONTENT
// ─────────────────────────────────────────────

const children = [];

// ── COVER PAGE ──────────────────────────────
children.push(
  new Paragraph({
    spacing: { before: 2000, after: 400 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'RSMS', bold: true, size: 52, color: DARK_BLUE })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Seafarer Technical Management System', size: 28, color: '475569' })],
  }),
  new Paragraph({
    spacing: { before: 200, after: 600 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Defects Module', bold: true, size: 48, color: MED_BLUE })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 160 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Functional User Manual', size: 32, color: '374151' })],
  }),
  new Paragraph({
    spacing: { before: 600, after: 80 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Version: Current Production', size: 20, color: '6b7280', italics: true })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 80 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Audience: Ship Staff · Superintendents · Office Users · PMS Administrators', size: 20, color: '6b7280', italics: true })],
  }),
  pageBreak()
);

// ── SECTION 1: OVERVIEW ──────────────────────
children.push(h1('1. Overview'));
children.push(para('The Defects Module is the central system for reporting, tracking, analysing, and closing technical deficiencies across the fleet. Every defect observed on any vessel — regardless of source — is recorded, managed, and resolved through this module.'));
children.push(spacer(80));
children.push(h3('The module covers six functional areas:'));
children.push(bullet('Defect Reporting — what failed, on which vessel, on which piece of equipment'));
children.push(bullet('Cause Analysis — immediate cause, root cause, risk classification'));
children.push(bullet('Action Management — corrective actions: who does what by when'));
children.push(bullet('Target Date Tracking — with a formal extension and approval workflow'));
children.push(bullet('Closeout — ship-side confirmation that work is physically complete'));
children.push(bullet('Office Verification — office-side sign-off that closure is satisfactory'));
children.push(bullet('Condition of Class (CoC) Tracking — mandatory regulatory defects in a separate view'));
children.push(bullet('Cross-Defect Linking — grouping related or recurring defects'));
children.push(spacer(80));
children.push(note('Every defect follows the same three-part form: Part A (Reporting) → Part B (Analysis & Actions) → Part C (Closeout & Verification)'));

// ── SECTION 2: NAVIGATION ───────────────────
children.push(spacer(200));
children.push(h1('2. Navigation & Module Layout'));
children.push(para('The Defects module has six pages accessible from the left-side navigation menu:'));
children.push(spacer(80));
children.push(table2col(
  ['Page', 'Purpose'],
  [
    ['Dashboard  (/defects)', 'High-level KPIs and analytical charts for the entire fleet'],
    ['Defect Log  (/defects/defect-log)', 'Full list of defects — Active and Resolved tabs with advanced filters'],
    ['Active Defects  (/defects/active)', 'Focused view of all open defects requiring attention'],
    ['CoC Defects  (/defects/coc)', 'Condition of Class defects only — regulatory and class-mandatory items'],
    ['Resolved Defects  (/defects/resolved)', 'Read-only archive of Closed and Verified defects'],
    ['Recurring Defects  (/defects/recurring)', 'Pattern analysis across the fleet (Coming Soon)'],
  ]
));

// ── SECTION 3: ID NUMBERING ──────────────────
children.push(spacer(200));
children.push(h1('3. Defect ID Numbering System'));
children.push(para('Every defect receives a unique, automatically generated ID when it is first saved. The ID follows a fixed format and cannot be manually entered or edited.'));
children.push(spacer(80));
children.push(h3('Format:  DEF-{VESSEL_ID}-{YEAR}-{NNN}'));
children.push(spacer(60));
children.push(table2col(
  ['Example ID', 'Meaning'],
  [
    ['DEF-V001-2025-001', 'First defect for vessel V001 in 2025'],
    ['DEF-MV-AURORA-2025-014', 'Fourteenth defect for MV Aurora in 2025'],
    ['DEF-V002-2026-003', 'Third defect for vessel V002 in 2026'],
  ]
));
children.push(spacer(80));
children.push(h4('Rules:'));
children.push(bullet('The ID is assigned by the server the moment the defect is first saved.'));
children.push(bullet('The running number resets to 001 every calendar year, per vessel.'));
children.push(bullet('The form displays "Auto-generated on save" in the header until the first save.'));
children.push(bullet('Once assigned, the ID cannot be changed.'));

// ── SECTION 4: STATUS MODEL ──────────────────
children.push(spacer(200));
children.push(h1('4. Defect Status Model'));
children.push(para('The system computes a status for every defect automatically based on the data in the record. You do not set a status manually — it is derived from dates, flags, and completed fields.'));
children.push(spacer(80));
children.push(h3('Status Priority Order (evaluated top → bottom; first match wins)'));
children.push(spacer(60));
children.push(table3col(
  ['Status', 'Indicator', 'When It Applies'],
  [
    ['Verified', 'Green', 'C2 Verification checkbox is ticked and all C2 fields are complete. This is the final state.'],
    ['Closed', 'Green', 'Date Completed (C1) is filled and falls on or before the Target Close Date.'],
    ['Closed (Late)', 'Orange', 'Date Completed is filled but falls after the Target Close Date.'],
    ['Overdue', 'Red', "Today's date is past the Target Close Date, no Date Completed entered, and no approved extension."],
    ['Extended', 'Blue', 'A target date extension has been approved (isDeferred flag = true).'],
    ['In Progress', 'Blue', 'At least one Action has been recorded in the Actions table in Part B.'],
    ['Reported', 'Grey', 'Defect was created but no actions have been added yet. This is the initial state.'],
  ],
  [18, 15, 67]
));
children.push(spacer(80));
children.push(note('The system evaluates from Verified downwards. A defect can only be in one status at a time. Verified always wins; Reported is the fallback.'));

// ── SECTION 5: DASHBOARD ─────────────────────
children.push(pageBreak());
children.push(h1('5. Dashboard'));
children.push(para('Path: /defects   |   Default period: Year-to-date'));
children.push(spacer(80));
children.push(para('The Dashboard provides a real-time fleet-wide summary of defect activity. It loads with the current year-to-date period and all vessels selected.'));

children.push(spacer(80));
children.push(h3('5.1  Filter Bar'));
children.push(table2col(
  ['Filter', 'Options'],
  [
    ['Vessel', 'All Vessels or a specific vessel from the fleet registry'],
    ['Period', 'Year / Quarter / Month selector, or a custom date range (defaults to YTD). Applied to the Issue Date of each defect.'],
  ]
));
children.push(spacer(60));
children.push(bullet('Click Clear to reset both filters to YTD / All Vessels.'));

children.push(spacer(120));
children.push(h3('5.2  KPI Cards'));
children.push(para('Six summary cards are displayed across the top of the dashboard. Every card is clickable — clicking opens a modal list of the specific defects counted in that card.'));
children.push(spacer(60));
children.push(table2col(
  ['Card', 'What It Counts'],
  [
    ['Active', 'All defects whose computed status is Reported, In Progress, Extended, or Overdue'],
    ['Resolved', 'All defects whose computed status is Closed or Verified'],
    ['CoC', 'Active defects where the Condition of Class (CoC) checkbox is ticked'],
    ['Overdue', 'Defects where today is past the Target Close Date and no Date Completed is filled'],
    ['Critical Equipment', 'Active defects where the Critical Eqpt. checkbox is ticked'],
    ['High Priority', 'Active defects where Priority is set to High'],
  ]
));
children.push(spacer(80));
children.push(para('A Resolution Rate percentage is also displayed: Resolved ÷ (Active + Resolved) × 100.'));

children.push(spacer(120));
children.push(h3('5.3  Management Tab Charts'));
children.push(bullet('Status Distribution (Pie Chart) — split of current defects by computed status. Each slice is clickable to drill down into that group.'));
children.push(bullet('Defects by Vessel (Stacked Bar Chart) — one bar per vessel, coloured by computed status. Each bar segment is clickable.'));

children.push(spacer(80));
children.push(h3('5.4  Operation Tab Charts'));
children.push(bullet('Top 10 by Defect Category — most commonly occurring defect categories'));
children.push(bullet('Top 10 by Defect Type — most commonly occurring defect types'));
children.push(bullet('Top 10 by Equipment Category — most frequently affected equipment categories'));
children.push(spacer(60));
children.push(note('Where more than 10 items exist, the remainder are grouped into an "Other" bar in the chart.'));

children.push(spacer(120));
children.push(h3('5.5  Recent Active Defects Table'));
children.push(para('The bottom of the dashboard shows the 5 most recently observed active defects, sorted by Issue Date descending. Columns shown: Vessel, Date Observed, Category, Component, Priority, Status. Clicking any row opens the full defect in View mode.'));

// ── SECTION 6: DEFECT LOG ────────────────────
children.push(pageBreak());
children.push(h1('6. Defect Log'));
children.push(para('Path: /defects/defect-log'));
children.push(spacer(60));
children.push(para('The Defect Log is the primary management view. It shows all defects in a sortable, filterable table with two tabs for Active and Resolved.'));

children.push(spacer(80));
children.push(h3('6.1  Tabs'));
children.push(table2col(
  ['Tab', 'Shows'],
  [
    ['Active', 'Defects with computed status: Reported, In Progress, Extended, Overdue'],
    ['Resolved', 'Defects with computed status: Closed, Verified'],
  ]
));

children.push(spacer(120));
children.push(h3('6.2  Filter Bar'));
children.push(table2col(
  ['Filter', 'Description'],
  [
    ['Vessel / Fleet / Group', 'Multi-select — choose one or more vessels, an entire fleet, or a vessel group'],
    ['Period', 'Year/Quarter/Month or custom date range, applied to Issue Date'],
    ['Search', 'Free-text search across Defect ID, Description, and Component'],
    ['Include Closed', 'Toggle to include closed defects in the Active tab view'],
    ['Due / Overdue', 'Filter for defects near or past their Target Close Date'],
  ]
));

children.push(spacer(120));
children.push(h3('6.3  Table Columns'));
children.push(para('Defect ID  ·  Vessel  ·  Date Observed  ·  Equipment Category  ·  Component  ·  Defect Category  ·  Defect Type  ·  Priority  ·  CoC  ·  Critical  ·  Status  ·  Target Date  ·  Actions'));

children.push(spacer(120));
children.push(h3('6.4  Row Actions'));
children.push(table2col(
  ['Action', 'Description'],
  [
    ['View (Eye icon)', 'Opens the defect in read-only View mode — no editing possible'],
    ['Edit (Pencil icon)', 'Opens the defect form in Edit mode — all unlocked fields are editable'],
    ['Add Note (Chat icon)', 'Opens the Add Note modal — adds a timestamped note to the defect history'],
    ['Link (Chain icon)', 'Opens the Link Defects modal — link this defect to one or more related defects'],
    ['Close (Tick icon)', 'Opens a quick closeout panel to fill Part C1 without opening the full form'],
  ]
));

children.push(spacer(80));
children.push(note('The table is sorted by Issue Date descending (most recent first) by default. Defects with no issue date are pushed to the bottom.'));

// ── SECTION 7: ACTIVE ────────────────────────
children.push(spacer(200));
children.push(h1('7. Active Defects View'));
children.push(para('Path: /defects/active'));
children.push(spacer(60));
children.push(para('A focused view showing only open defects (Reported, In Progress, Extended, Overdue). Provides the same filter bar and row actions as the Defect Log. Use this for day-to-day work on the vessel.'));
children.push(spacer(60));
children.push(bullet('The + New Defect button (top right) starts a new defect report directly from this view.'));

// ── SECTION 8: COC ───────────────────────────
children.push(spacer(200));
children.push(h1('8. Condition of Class (CoC) Defects'));
children.push(para('Path: /defects/coc'));
children.push(spacer(60));
children.push(para('This view shows only defects where the CoC (Condition of Class) checkbox is ticked. These are defects raised against classification society requirements. Failure to resolve them within the required timeframe may affect the vessel\'s class certificate.'));
children.push(spacer(60));
children.push(h4('How a defect becomes a CoC defect:'));
children.push(bullet('Tick the CoC checkbox in Part A of the defect form at any point.'));
children.push(bullet('When clicking + New Defect from the CoC page, the CoC checkbox is automatically pre-selected.'));
children.push(bullet('CoC status can be added or removed at any time while the defect is open.'));

// ── SECTION 9: RESOLVED ──────────────────────
children.push(spacer(200));
children.push(h1('9. Resolved Defects'));
children.push(para('Path: /defects/resolved'));
children.push(spacer(60));
children.push(para('A read-only archive of all defects with a computed status of Closed or Verified. Defects move into this view automatically when Part C1 closeout is completed. No editing is available from this page — records can be opened in View mode to review the complete history.'));

// ── SECTION 10: CREATING A DEFECT ───────────────
children.push(pageBreak());
children.push(h1('10. Creating a New Defect — Step-by-Step'));
children.push(spacer(60));
children.push(step(1, 'Navigate to Active Defects (/defects/active) or Defect Log (/defects/defect-log).'));
children.push(step(2, 'Click + New Defect in the top right corner.'));
children.push(step(3, 'The Defect Form opens in full-screen mode. A left-side panel shows three parts: A (Reporting), B (Analysis & Actions), C (Closeout). Click any part label to jump to that section.'));
children.push(step(4, 'Fill in Part A — the four mandatory fields are: Vessel, Date Observed, Component, and Description.'));
children.push(step(5, 'Click SAVE (top right blue button) to save at any time. The Defect ID is assigned by the system on the first save.'));
children.push(step(6, 'Continue to Part B — add cause analysis (Immediate Cause, Root Cause), risk level, and at least one corrective Action.'));
children.push(step(7, 'Click SAVE again.'));
children.push(step(8, 'When the physical work is complete on the vessel, scroll to Part C and fill in the C1 Closeout fields.'));
children.push(step(9, 'Click SAVE. The defect computed status changes to Closed.'));
children.push(step(10, 'Office users then open the defect and fill in Part C2 Verification. On saving, status changes to Verified (final state).'));
children.push(step(11, 'Click X to close the form. If there are any unsaved changes, the system auto-saves before closing.'));
children.push(spacer(80));
children.push(note('The defect ID is shown in the form header after the first save. Before saving, the header shows "Auto-generated on save".'));

// ── SECTION 11: PART A ───────────────────────
children.push(pageBreak());
children.push(h1('11. Part A: Reporting — All Fields Explained'));
children.push(para('Part A captures what happened, where, when, and who reported it. It is the founding record of the defect.'));

children.push(spacer(80));
children.push(h3('Mandatory Fields (marked with a red * in the form)'));
children.push(table2col(
  ['Field', 'Explanation'],
  [
    ['Vessel  *', 'Select from the dropdown list of active vessels. Changing the vessel clears the Component, Make, and Model fields automatically.'],
    ['Date Observed  *', 'The date the defect was physically observed on board. Cannot be set to a future date.'],
    ['Component  *', 'Select from the vessel\'s component register using the searchable combobox. Selecting a component automatically fills the Make and Model fields from the register.'],
    ['Description  *', 'Free text. Describe exactly what failed or was observed, the extent of the defect, and any immediate operational impact.'],
  ]
));

children.push(spacer(120));
children.push(h3('Optional Fields — Basic Column'));
children.push(table2col(
  ['Field', 'Explanation'],
  [
    ['Source', 'How the defect was identified. Select from 34 options across 7 categories (full list in Section 24).'],
    ['Defect Category', 'Classification of the defect. Values are configurable by Admin in the reference data.'],
    ['Defect Type', 'Sub-type classification of the defect. Values are configurable by Admin.'],
    ['Raised By', 'The rank and name of the person raising the defect. Select from the crew list.'],
    ['CoC', 'Tick if this is a Condition of Class item. Defect appears immediately in the CoC Defects view.'],
    ['Critical Eqpt.', 'Tick if the component is classified as critical equipment. Increases visibility in the Dashboard Critical KPI.'],
  ]
));

children.push(spacer(120));
children.push(h3('Optional Fields — Equipment / Hardware Column'));
children.push(table2col(
  ['Field', 'Explanation'],
  [
    ['Category', 'Equipment Category — a broader classification than Component. Select from the equipment categories list.'],
    ['Component  *', 'As described above. Selecting the component auto-fills Make and Model.'],
    ['Make', 'Read-only. Auto-populated from the component register when a component is selected. Cannot be manually edited.'],
    ['Model', 'Read-only. Auto-populated from the component register when a component is selected. Cannot be manually edited.'],
  ]
));

children.push(spacer(120));
children.push(h3('SIRE Fields (inside Part A)'));
children.push(para('These fields are relevant when the defect was identified during a SIRE vetting inspection.'));
children.push(spacer(60));
children.push(table2col(
  ['Field', 'Explanation'],
  [
    ['VIQ Version', 'Select the SIRE version applicable to this inspection: SIRE 2.0 or SIRE. Changing the version clears the VIQ Reference field.'],
    ['VIQ Reference', 'The specific SIRE 2.0 question reference number. The dropdown is filtered to show only references matching the selected VIQ Version.'],
    ['SIRE Hardware Class', 'Three-level equipment classification (Level 1 → Level 2 → Level 3). Use the cascading combobox to select. Levels auto-cascade on selection.'],
  ]
));

children.push(spacer(120));
children.push(h3('Optional Fields — Timeline Column'));
children.push(table2col(
  ['Field', 'Explanation'],
  [
    ['Date Observed  *', 'As above — the physical observation date. Cannot be a future date.'],
    ['Date Reported to Office', 'The date the ship formally notified the office of this defect. Cannot be a future date.'],
    ['Date Registered in System', 'The date the record was created in the system. Defaults to today. Cannot be a future date. This date is the minimum allowed value for the Target Date.'],
    ['Target Date', 'The planned date by which the defect must be closed. Must be on or after the Date Registered in System. Displays an Extended badge if a target date extension has been approved.'],
    ['Date Closed', 'Read-only display field. Automatically reflects the Date Completed from Part C1 once filled. Cannot be edited here.'],
  ]
));

children.push(spacer(120));
children.push(h3('Part A Attachments'));
children.push(para('A file attachment section is available at the bottom of Part A. Use this to attach photographs of the defect, class survey reports, inspection findings, or any evidence captured at the time of observation.'));
children.push(spacer(60));
children.push(bullet('Click + Add Attachment to open the attachment dialog.'));
children.push(bullet('Each attachment can optionally have a title and description.'));
children.push(bullet('Supported formats: any file type (PDF, images, documents, spreadsheets, etc.).'));
children.push(bullet('Attachments are saved when the main SAVE button is clicked.'));

// ── SECTION 12: PART B ───────────────────────
children.push(pageBreak());
children.push(h1('12. Part B: Analysis & Actions — All Fields Explained'));
children.push(para('Part B captures why the defect occurred and what corrective actions are planned or underway.'));

children.push(spacer(80));
children.push(h3('B1 — Immediate Cause'));
children.push(table2col(
  ['Field', 'How to Fill'],
  [
    ['Immediate Cause', 'Click the Select Cause button to open the Immediate Cause Modal. Choose one or more items from two categories:\n• Unsafe Act — behaviour-related immediate causes\n• Unsafe Condition — environment or equipment-related causes\nSelected items are formatted automatically as a structured bulleted list.'],
    ['Immediate Cause Explanation', 'Free text. Expand on the selected cause codes with a detailed narrative of what exactly occurred.'],
  ]
));

children.push(spacer(120));
children.push(h3('B2 — Root Cause'));
children.push(table2col(
  ['Field', 'How to Fill'],
  [
    ['Root Cause', 'Click the Select Root Cause button to open the Root Cause Modal. Choose from two categories:\n• Individual Factor — causes related to the person involved\n• System Factor — causes related to management, processes, or procedures\nSelected items are formatted as a structured list.'],
    ['Root Cause Explanation', 'Free text. Provide a detailed explanation of the underlying root cause — what systemic or individual factor allowed this defect to occur.'],
  ]
));

children.push(spacer(120));
children.push(h3('B3 — Risk Level'));
children.push(table2col(
  ['Field', 'Explanation'],
  [
    ['Risk Level', 'Select from the configured risk levels (e.g., Low, Medium, High, Critical). These values are defined in the system reference data by the Admin.'],
  ]
));

children.push(spacer(120));
children.push(h3('B4 — Actions Table'));
children.push(para('The Actions table records every corrective and preventive action planned or taken for this defect. Adding at least one action changes the defect status from Reported to In Progress.'));
children.push(spacer(60));
children.push(para('To add an action: Click + Add Action. The Add Action modal opens with these fields:'));
children.push(spacer(60));
children.push(table2col(
  ['Field', 'Description'],
  [
    ['Action Type', 'Category of the action — e.g., Repair, Inspection, Replace, Monitor, Overhaul'],
    ['Action Description', 'Free text. Describe exactly what action is to be taken to address this defect.'],
    ['Proposed By', 'Name/rank of the person proposing this action'],
    ['Responsibility', 'The person or role responsible for executing and completing the action'],
    ['Due Date', 'The target completion date for this specific action'],
    ['Status', 'Current progress status: Open, In Progress, Completed, Deferred, etc.'],
    ['Date Completed', 'The actual date this action was completed. Fill this once the action is done.'],
  ]
));
children.push(spacer(60));
children.push(bullet('To edit an action: Click the pencil (edit) icon on the action row.'));
children.push(bullet('To delete an action: Click the trash (delete) icon. Deletion is immediate — no confirmation is required.'));
children.push(bullet('Actions are saved as part of the defect record and appear in PDF exports.'));

children.push(spacer(120));
children.push(h3('B5 — Target Date Extension'));
children.push(para('See full details in Section 16 — Target Date Extension Workflow.'));

// ── SECTION 13: PART C1 ──────────────────────
children.push(pageBreak());
children.push(h1('13. Part C1: Closeout — All Fields Explained'));
children.push(para('Part C1 is completed by ship-side staff when the physical remedial work is done and the defect is ready to be closed.'));
children.push(spacer(60));
children.push(warning('Part C1 is all-or-nothing. If you start filling any C1 field, all four fields become mandatory before the record can be saved. Do not partially complete C1.'));
children.push(spacer(80));
children.push(table2col(
  ['Field', 'Description'],
  [
    ['Confirm Completed', 'Tick this checkbox to confirm that the remedial work has been physically completed on board. This is the primary closure trigger.'],
    ['Date Completed', 'The date the work was physically completed. This is the key date — it drives the defect\'s computed status to Closed.'],
    ['Action Taken', 'Free text. Describe exactly what was physically done on board to resolve the defect. This is the permanent closeout record.'],
    ['Closed By (Name)', 'Full name of the officer signing off the closure.'],
    ['Closed By (Rank)', 'Rank or designation of the closing officer — e.g., Chief Engineer, Master, Chief Officer.'],
  ]
));
children.push(spacer(80));
children.push(note('Once Confirm Completed is ticked and Date Completed is filled, the defect moves to Closed status. It will appear in the Resolved view.'));

children.push(spacer(120));
children.push(h3('Part C Attachments'));
children.push(para('A file attachment section is also available in Part C for attaching:'));
children.push(bullet('Closure photographs showing the completed repair'));
children.push(bullet('Class surveyor confirmation letters'));
children.push(bullet('Repair certificates or inspection reports'));
children.push(bullet('Any other documentation supporting the closure'));

// ── SECTION 14: PART C2 ──────────────────────
children.push(spacer(200));
children.push(h1('14. Part C2: Verification — All Fields Explained'));
children.push(para('Part C2 is completed by office-side users to confirm that the ship\'s closeout is satisfactory and meets the required standard.'));
children.push(spacer(60));
children.push(warning('Pre-condition: Part C1 must be fully completed before any C2 field can be saved. Attempting to save C2 fields with an incomplete C1 will block the save.'));
children.push(spacer(60));
children.push(warning('Like C1, Part C2 is all-or-nothing. If any C2 field is filled, all four must be filled before saving.'));
children.push(spacer(80));
children.push(table2col(
  ['Field', 'Description'],
  [
    ['Verified', 'Tick this checkbox to confirm office-side verification is complete. This drives the computed status to Verified — the final, permanent state of a defect.'],
    ['Date Verified', 'The date the office verification was performed.'],
    ['Verified By (Name)', 'Full name of the office person performing the verification.'],
    ['Verified By (Office Position)', 'Job title or position of the verifying person — e.g., Superintendent, Fleet Manager.'],
  ]
));

children.push(spacer(120));
children.push(h3('Auto-Fill for Office and PMS Admin Users'));
children.push(para('When a user with role Office, PMS Admin, or Sail Admin ticks the Verified checkbox, the system automatically fills the remaining three fields:'));
children.push(bullet('Date Verified → today\'s date'));
children.push(bullet('Verified By (Name) → the logged-in user\'s full name'));
children.push(bullet('Verified By (Office Position) → the logged-in user\'s crew designation (or role if no designation is set)'));
children.push(spacer(60));
children.push(note('Auto-filled values can be manually overridden if needed before clicking SAVE.'));

// ── SECTION 15: ACTIONS LOG ──────────────────
children.push(pageBreak());
children.push(h1('15. Actions Log (Inside a Defect)'));
children.push(para('The Actions table in Part B is both a planning tool and a running audit log of all actions recorded against a defect throughout its lifecycle.'));
children.push(spacer(80));
children.push(h3('Key Points:'));
children.push(bullet('Actions are embedded in the defect record — they are not separate database entries. They travel with the defect and appear in PDF exports.'));
children.push(bullet('Multiple actions can be added for a single defect — one for immediate temporary repair, another for permanent fix, another for spare parts ordering, etc.'));
children.push(bullet('Actions should be updated as work progresses. When an action is completed, edit it, set Status to Completed, and fill Date Completed.'));
children.push(bullet('Actions are visible to both ship and office users, creating a shared, transparent record of progress.'));
children.push(spacer(80));
children.push(h3('Recommended Workflow for Actions:'));
children.push(step(1, 'When raising the defect in Part B, add an initial action describing the planned corrective measure.'));
children.push(step(2, 'If additional actions become necessary (e.g., parts must be ordered, temporary repair done first), add further actions.'));
children.push(step(3, 'As each action is completed, edit it and update the Status to Completed and fill Date Completed.'));
children.push(step(4, 'When all actions are done and the equipment is restored, proceed to Part C1 Closeout.'));

// ── SECTION 16: TARGET DATE EXTENSION ───────────────
children.push(spacer(200));
children.push(h1('16. Target Date Extension Workflow (B5)'));
children.push(para('When a defect cannot be resolved by the original Target Date, a formal extension must be requested through the system and approved by an office user before the defect is considered "Extended" rather than "Overdue".'));

children.push(spacer(80));
children.push(h3('How to Request an Extension'));
children.push(step(1, 'Open the defect in Edit mode.'));
children.push(step(2, 'Scroll to Part B, Section B5 — Target Date Extension.'));
children.push(step(3, 'Click + Extend Target Date to expand the extension form.'));
children.push(step(4, 'Fill in the required fields (see table below).'));
children.push(step(5, 'Click the Submit button inside the B5 section to commit the extension entry to the history list.'));
children.push(step(6, 'Click the main SAVE button to persist the full record.'));
children.push(spacer(80));
children.push(table2col(
  ['Field', 'Description'],
  [
    ['New Target Date  *', 'The proposed revised target date. Must be in the future.'],
    ['Reason for Extension  *', 'Mandatory free text explaining why the original date cannot be met — e.g., awaiting parts, weather delay, dry dock scheduling.'],
    ['Submit for Approval To', 'Select the office user who should approve this extension. The dropdown shows only users with Office role.'],
  ]
));

children.push(spacer(120));
children.push(h3('Extension Status Values'));
children.push(table2col(
  ['Status', 'Meaning'],
  [
    ['Requested', 'Extension has been submitted. Awaiting office approval.'],
    ['Approved', 'Office has approved the new target date. The defect status changes to Extended. The isDeferred flag is set.'],
    ['Rejected', 'Office has rejected the extension. The defect reverts to Overdue if the original date has passed.'],
  ]
));

children.push(spacer(120));
children.push(h3('Multiple Extensions'));
children.push(para('A defect can have multiple extension requests over time. Each extension is stored as a separate entry in the extension history list. The most recent extension is shown in the active B5 form.'));

children.push(spacer(80));
children.push(h3('Important Save Guard'));
children.push(warning('If you type into the B5 extension form fields but do not click the B5 Submit button, the main SAVE will be blocked. The system prevents silent loss of extension data. Always click Submit inside B5 first, then SAVE the main form.'));

children.push(spacer(80));
children.push(note('The most recent extension entry is included in the PDF export of the defect report.'));

// ── SECTION 17: ATTACHMENTS ──────────────────
children.push(pageBreak());
children.push(h1('17. Attachments'));
children.push(para('Attachments can be added in two locations within a defect record:'));
children.push(spacer(60));
children.push(table2col(
  ['Location', 'Purpose'],
  [
    ['Part A — Attachments', 'Evidence collected at time of observation: photos of the defect, inspection reports, class surveyor notes, vetting observation references'],
    ['Part C — Attachments', 'Closure documentation: repair photos, completion certificates, class confirmation letters, office sign-off documents'],
  ]
));

children.push(spacer(80));
children.push(h3('How to Add an Attachment'));
children.push(step(1, 'Click + Add Attachment in the relevant section (Part A or Part C).'));
children.push(step(2, 'The File Attachment Dialog opens.'));
children.push(step(3, 'Click to select a file from your device, or drag and drop.'));
children.push(step(4, 'Optionally add a title and description for the attachment.'));
children.push(step(5, 'Click Attach.'));
children.push(step(6, 'Click the main SAVE button — attachments are saved as part of the defect record.'));
children.push(spacer(60));
children.push(note('Attachments are listed below the attachment button with their filename, file size, and type. Use the preview icon to view, or the download icon to download.'));

// ── SECTION 18: LINKING ──────────────────────
children.push(spacer(200));
children.push(h1('18. Linking Defects'));
children.push(para('Related defects can be formally linked to each other — for example, the same piece of equipment failing multiple times, or defects raised across different vessels on the same component type.'));

children.push(spacer(80));
children.push(h3('How to Link Defects'));
children.push(step(1, 'In the Defect Log or Active view, click the Link (chain) icon on any defect row.'));
children.push(step(2, 'The Link Defects Modal opens.'));
children.push(step(3, 'Search for the defects you want to link — by Defect ID, vessel, or description.'));
children.push(step(4, 'Select the relevant defects.'));
children.push(step(5, 'Click Save Links.'));

children.push(spacer(80));
children.push(h3('What Linking Does'));
children.push(bullet('Creates a bidirectional association — both defects show the link.'));
children.push(bullet('Provides quick navigation between related issues from within each defect record.'));
children.push(bullet('Helps identify recurring patterns on the same equipment for root cause trending and CAPA planning.'));

// ── SECTION 19: NOTES ───────────────────────
children.push(spacer(200));
children.push(h1('19. Adding Notes to a Defect'));
children.push(para('Notes provide a timestamped communication and progress trail attached to a defect, without modifying the main defect record fields.'));

children.push(spacer(80));
children.push(h3('How to Add a Note'));
children.push(step(1, 'In the Defect Log or Active view, click the Note (chat bubble) icon on the defect row.'));
children.push(step(2, 'The Add Note Modal opens.'));
children.push(step(3, 'Enter the note text. Minimum length is 10 characters.'));
children.push(step(4, 'Optionally attach a file to the note.'));
children.push(step(5, 'Click Save Note.'));

children.push(spacer(80));
children.push(warning('Notes are permanent. Once saved, a note cannot be edited or deleted. It forms part of the immutable audit trail of the defect.'));
children.push(spacer(60));
children.push(para('Each note is saved with the author name and a timestamp. Notes are visible to all users who can view the defect.'));

// ── SECTION 20: PDF EXPORT ───────────────────
children.push(pageBreak());
children.push(h1('20. Exporting a Defect to PDF'));
children.push(para('A complete defect report can be exported to PDF at any time from the defect form.'));

children.push(spacer(80));
children.push(h3('How to Export'));
children.push(step(1, 'Open any defect in View or Edit mode.'));
children.push(step(2, 'Click the Export button (download icon) in the top-right header of the form.'));
children.push(step(3, 'A PDF is generated in the browser and downloaded automatically to your device.'));

children.push(spacer(80));
children.push(h3('PDF Content'));
children.push(para('The exported PDF is a formatted report containing:'));
children.push(spacer(40));
children.push(table2col(
  ['Section', 'Fields Included'],
  [
    ['Header', 'Report ID, Vessel, Date Observed, Source, Component, Make, Model'],
    ['Classification', 'Defect Category, Defect Type, Priority, CoC flag, Critical flag'],
    ['Dates', 'Observed, Reported to Office, Registered in System, Target, Closed'],
    ['Description', 'Full defect description text'],
    ['Analysis', 'Immediate Cause (structured list), Immediate Cause Explanation, Root Cause (structured list), Root Cause Explanation, Risk Level'],
    ['SIRE Details', 'VIQ Version, VIQ Reference, SIRE Hardware Class'],
    ['Actions', 'All actions: Type, Description, Proposed By, Responsibility, Due Date, Status'],
    ['Target Date Extension', 'Most recent extension: New Date, Reason, Approval Status, Approval Date, Approver Comments'],
    ['Part C1 Closeout', 'Confirm Completed, Date Completed, Action Taken, Closed By Name/Rank'],
    ['Part C2 Verification', 'Verified flag, Date Verified, Verified By Name/Office Position'],
  ]
));

// ── SECTION 21: VALIDATION ───────────────────
children.push(pageBreak());
children.push(h1('21. Form Validation Rules'));
children.push(para('The system enforces the following rules at save time. If a rule is violated, a red error notification is displayed and the save is blocked until the issue is corrected.'));

children.push(spacer(80));
children.push(h3('Part A — Mandatory Fields'));
children.push(table2col(
  ['Field', 'Rule'],
  [
    ['Vessel', 'Cannot be empty. A vessel must be selected from the list.'],
    ['Date Observed', 'Cannot be empty and cannot be a future date.'],
    ['Component', 'Cannot be empty. A component must be selected from the vessel\'s register.'],
    ['Description', 'Cannot be empty.'],
  ]
));

children.push(spacer(120));
children.push(h3('Part B5 — Extension Dirty State Guard'));
children.push(table2col(
  ['Situation', 'What Happens'],
  [
    ['B5 form fields filled but the B5 Submit button not clicked', '"Part B5 has an unsaved extension — click Submit inside the B5 section first, or clear the fields before saving."'],
    ['New Target Date or Reason missing when B5 Submit is clicked', '"Please fill in: New Target Date, Reason for Extension"'],
  ]
));

children.push(spacer(120));
children.push(h3('Part C1 — All-or-Nothing Rule'));
children.push(table2col(
  ['Situation', 'What Happens'],
  [
    ['Any C1 field is filled but not all four fields are complete', 'Save blocked. Error lists the missing fields: Confirm Completed, Date Completed, Closed By (Name), Closed By (Rank).'],
    ['All four C1 fields are complete', 'Save proceeds normally.'],
  ]
));

children.push(spacer(120));
children.push(h3('Part C2 — Requires C1 + All-or-Nothing Rule'));
children.push(table2col(
  ['Situation', 'What Happens'],
  [
    ['Any C2 field filled with C1 incomplete', '"Part C (Closeout) must be fully completed before filling Part D (Verification)." Save blocked.'],
    ['Any C2 field filled but not all four are complete', 'Save blocked. Error lists the missing fields: Verified, Date Verified, Verified By (Name), Verified By (Office Position).'],
    ['C1 complete and all C2 fields complete', 'Save proceeds. Defect status becomes Verified.'],
  ]
));

// ── SECTION 22: AUTO-SAVE ────────────────────
children.push(spacer(200));
children.push(h1('22. Auto-Save Behaviour'));
children.push(para('When you click the X (close) button to exit the defect form:'));
children.push(spacer(60));
children.push(bullet('If the form has unsaved changes (any field modified since the last save), the system automatically saves the current state before closing.'));
children.push(bullet('A toast notification confirms: "Defect saved automatically".'));
children.push(bullet('If there are no unsaved changes, the form closes without any save operation.'));
children.push(spacer(60));
children.push(note('This behaviour prevents accidental data loss if a user navigates away from the form without explicitly clicking SAVE.'));

// ── SECTION 23: PERMISSIONS ──────────────────
children.push(pageBreak());
children.push(h1('23. Role-Based Permissions'));
children.push(spacer(60));

const permRows = [
  ['View defects (all views)', '✓', '✓', '✓', '✓'],
  ['Create new defect', '✓', '✓', '✓', '✓'],
  ['Edit Part A and Part B', '✓', '✓', '✓', '✓'],
  ['Complete Part C1 (Closeout)', '✓', '✓', '✓', '✓'],
  ['Complete Part C2 (Verification)', '—', '✓', '✓', '✓'],
  ['Auto-fill C2 on Verified tick', '—', '—', '✓', '✓'],
  ['Request target date extension', '✓', '✓', '✓', '✓'],
  ['Approve / Reject extension', '—', '✓', '✓', '✓'],
  ['Add notes', '✓', '✓', '✓', '✓'],
  ['Link defects', '✓', '✓', '✓', '✓'],
  ['Export to PDF', '✓', '✓', '✓', '✓'],
  ['Delete a defect', '—', '—', '—', '✓'],
];

const permHeaderRow = new TableRow({
  tableHeader: true,
  children: [
    headerCell('Action', 40),
    headerCell('Ship Staff\n(Master / CE)', 15),
    headerCell('Superintendent', 15),
    headerCell('Office', 15),
    headerCell('PMS Admin /\nSail Admin', 15),
  ],
});
const permDataRows = permRows.map((row, ri) => {
  const bg = ri % 2 === 0 ? 'FFFFFF' : ROW_ALT;
  return new TableRow({
    children: [
      dataCell(row[0], 40, false, '1f2937', bg),
      dataCell(row[1], 15, false, row[1] === '✓' ? GREEN : RED, bg),
      dataCell(row[2], 15, false, row[2] === '✓' ? GREEN : RED, bg),
      dataCell(row[3], 15, false, row[3] === '✓' ? GREEN : RED, bg),
      dataCell(row[4], 15, false, row[4] === '✓' ? GREEN : RED, bg),
    ],
  });
});

children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [permHeaderRow, ...permDataRows],
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
}));

// ── SECTION 24: SOURCE REFERENCE ────────────────
children.push(pageBreak());
children.push(h1('24. Source of Defect — Full Reference List'));
children.push(para('When raising a defect, select the Source that best describes how the defect was identified. There are 34 options across 7 categories:'));

children.push(spacer(80));
children.push(h3('SIRE Inspections'));
children.push(table2col(['Code', 'Display Name'], [
  ['SIRE_2_0', 'SIRE 2.0'],
  ['SIRE', 'SIRE'],
  ['NON_SIRE', 'Non-SIRE'],
]));

children.push(spacer(80));
children.push(h3('External Inspections'));
children.push(table2col(['Code', 'Display Name'], [
  ['CDI', 'CDI'],
  ['PSC', 'PSC'],
  ['TERMINAL', 'Terminal'],
  ['EXTERNAL_AUDIT_CLASS', 'External Audit (Class)'],
  ['FLAG_STATE_INSPECTION', 'Flag State Inspection'],
  ['RISQ_INSPECTION', 'RISQ Inspection'],
]));

children.push(spacer(80));
children.push(h3('Internal Audits'));
children.push(table2col(['Code', 'Display Name'], [
  ['INTERNAL_AUDIT', 'Internal Audit'],
  ['SUPERINTENDENT_INSPECTION', 'Superintendent Inspection'],
]));

children.push(spacer(80));
children.push(h3('Operational Audits'));
children.push(table2col(['Code', 'Display Name'], [
  ['NAVIGATION_AUDIT', 'Navigation Audit'],
  ['REAL_TIME_NAVIGATION_AUDIT', 'Real Time Navigation Audit'],
  ['VDR_REVIEW', 'VDR Review'],
  ['CARGO_AUDIT', 'Cargo Audit'],
  ['MOORING_AUDIT', 'Mooring Audit'],
  ['BUNKERING_AUDIT', 'Bunkering Audit'],
  ['ENGINEERING_AUDIT', 'Engineering Audit'],
  ['ENVIRONMENT_AUDIT', 'Environment Audit'],
]));

children.push(spacer(80));
children.push(h3('Preparation'));
children.push(table2col(['Code', 'Display Name'], [
  ['PRE_VETTING', 'Pre-Vetting'],
  ['SIRE_2_0_PREPARATION', 'SIRE 2.0 Preparation'],
  ['RISQ_PREPARATION', 'RISQ Preparation'],
]));

children.push(spacer(80));
children.push(h3('Observations'));
children.push(table2col(['Code', 'Display Name'], [
  ['OBSERVED_BY_SHIP_STAFF', 'Observed by Ship Staff'],
  ['OBSERVED_BY_OFFICE_STAFF', 'Observed by Office Staff'],
  ['OBSERVED_BY_OTHER_3RD_PARTIES', 'Observed by Other 3rd Parties'],
]));

children.push(spacer(80));
children.push(h3('Incident Management'));
children.push(table2col(['Code', 'Display Name'], [
  ['INCIDENT', 'Incident'],
]));

// ── SECTION 25: RECURRING ───────────────────
children.push(pageBreak());
children.push(h1('25. Recurring Defects'));
children.push(para('Path: /defects/recurring   |   Status: Coming Soon'));
children.push(spacer(60));
children.push(para('This page is planned to provide automatic identification of equipment with repeated failures across the fleet.'));

children.push(spacer(80));
children.push(h3('Planned Functionality'));
children.push(bullet('Automatic pattern detection — identifies the same component failing multiple times within a configurable time window (default: 12 months).'));
children.push(bullet('Cross-vessel analysis — surfaces patterns across vessels on the same make/model of equipment.'));
children.push(bullet('CoC filter — option to view only recurring CoC defects.'));
children.push(bullet('Configurable thresholds — set minimum number of occurrences (default: 2) and the analysis window in months.'));
children.push(bullet('Drill-down — click a recurring pattern to see all individual defect records contributing to it.'));
children.push(bullet('CAPA initiation — ability to initiate a Corrective Action and Preventive Action directly from a recurring defect.'));
children.push(bullet('Notifications — send alerts to relevant users when a recurring pattern is detected.'));
children.push(bullet('Export — download the full recurring defects analysis as CSV.'));

children.push(spacer(80));
children.push(note('Until this feature is released, use the Top 10 by Equipment Category chart on the Dashboard as a manual proxy for identifying frequently affected equipment.'));

// ─────────────────────────────────────────────
//  BUILD AND WRITE DOCUMENT
// ─────────────────────────────────────────────

const doc = new Document({
  creator: 'RSMS System',
  title: 'RSMS Defects Module — Functional User Manual',
  description: 'Complete functional user manual for the Defects Module of the RSMS Maritime PMS',
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 20, color: '1f2937' },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          },
        },
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const outPath = path.join(__dirname, '..', 'docs', 'RSMS_Defects_Module_User_Manual.docx');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log('Done:', outPath);
});
