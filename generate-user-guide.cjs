const puppeteer = require("puppeteer");
const sharp = require("sharp");
const docx = require("docx");
const fs = require("fs");
const path = require("path");

const CHROMIUM_PATH = "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium";

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak, ImageRun,
  Header, Footer, PageNumber
} = docx;

const BASE_URL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const SS_DIR = path.join(__dirname, "screenshots");

if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

async function annotateImage(inputPath, outputPath, rects) {
  const img = sharp(inputPath);
  const meta = await img.metadata();
  const w = meta.width;
  const h = meta.height;
  let svgOverlay = `<svg width="${w}" height="${h}">`;
  for (const r of rects) {
    const rx = Math.round(r.x * w);
    const ry = Math.round(r.y * h);
    const rw = Math.round(r.w * w);
    const rh = Math.round(r.h * h);
    svgOverlay += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="none" stroke="red" stroke-width="3" rx="4"/>`;
    if (r.label) {
      svgOverlay += `<circle cx="${rx - 12}" cy="${ry - 12}" r="12" fill="red"/>`;
      svgOverlay += `<text x="${rx - 12}" y="${ry - 7}" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial">${r.label}</text>`;
    }
  }
  svgOverlay += `</svg>`;
  await img.composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }]).toFile(outputPath);
}

const screenshotSpecs = [
  {
    id: "dashboard_overview",
    path: "/pms/dashboard",
    wait: 3000,
    annotations: [
      { x: 0.07, y: 0.10, w: 0.28, h: 0.82, label: "1" },
      { x: 0.30, y: 0.10, w: 0.37, h: 0.82, label: "2" },
      { x: 0.67, y: 0.10, w: 0.32, h: 0.82, label: "3" },
    ]
  },
  {
    id: "dashboard_filters",
    path: "/pms/dashboard",
    wait: 2000,
    annotations: [
      { x: 0.14, y: 0.07, w: 0.14, h: 0.06, label: "1" },
      { x: 0.36, y: 0.07, w: 0.22, h: 0.06, label: "2" },
      { x: 0.55, y: 0.07, w: 0.22, h: 0.06, label: "3" },
      { x: 0.93, y: 0.07, w: 0.06, h: 0.06, label: "4" },
    ]
  },
  {
    id: "components_main",
    path: "/pms/components",
    wait: 3000,
    annotations: [
      { x: 0.06, y: 0.13, w: 0.29, h: 0.82, label: "1" },
      { x: 0.36, y: 0.13, w: 0.63, h: 0.82, label: "2" },
    ]
  },
  {
    id: "components_filters",
    path: "/pms/components",
    wait: 2000,
    annotations: [
      { x: 0.08, y: 0.18, w: 0.20, h: 0.06, label: "1" },
      { x: 0.30, y: 0.18, w: 0.22, h: 0.06, label: "2" },
      { x: 0.52, y: 0.18, w: 0.20, h: 0.06, label: "3" },
      { x: 0.74, y: 0.11, w: 0.12, h: 0.06, label: "4" },
      { x: 0.86, y: 0.11, w: 0.13, h: 0.06, label: "5" },
    ]
  },
  {
    id: "workorders_main",
    path: "/pms/work-orders",
    wait: 3000,
    annotations: [
      { x: 0.31, y: 0.09, w: 0.50, h: 0.07, label: "1" },
      { x: 0.08, y: 0.17, w: 0.86, h: 0.06, label: "2" },
      { x: 0.08, y: 0.25, w: 0.90, h: 0.55, label: "3" },
      { x: 0.80, y: 0.09, w: 0.10, h: 0.06, label: "4" },
      { x: 0.87, y: 0.09, w: 0.12, h: 0.06, label: "5" },
    ]
  },
  {
    id: "workorders_tabs",
    path: "/pms/work-orders",
    wait: 2000,
    annotations: [
      { x: 0.31, y: 0.10, w: 0.10, h: 0.06, label: "1" },
      { x: 0.41, y: 0.10, w: 0.07, h: 0.06, label: "2" },
      { x: 0.48, y: 0.10, w: 0.10, h: 0.06, label: "3" },
      { x: 0.58, y: 0.10, w: 0.12, h: 0.06, label: "4" },
      { x: 0.70, y: 0.10, w: 0.10, h: 0.06, label: "5" },
    ]
  },
  {
    id: "runninghours_main",
    path: "/pms/running-hrs",
    wait: 3000,
    annotations: [
      { x: 0.45, y: 0.10, w: 0.14, h: 0.06, label: "1" },
      { x: 0.08, y: 0.18, w: 0.45, h: 0.06, label: "2" },
      { x: 0.08, y: 0.26, w: 0.90, h: 0.60, label: "3" },
      { x: 0.78, y: 0.10, w: 0.09, h: 0.06, label: "4" },
      { x: 0.86, y: 0.10, w: 0.13, h: 0.06, label: "5" },
    ]
  },
  {
    id: "spares_main",
    path: "/spares",
    wait: 3000,
    annotations: [
      { x: 0.06, y: 0.24, w: 0.29, h: 0.65, label: "1" },
      { x: 0.35, y: 0.24, w: 0.63, h: 0.65, label: "2" },
      { x: 0.43, y: 0.10, w: 0.28, h: 0.06, label: "3" },
      { x: 0.08, y: 0.18, w: 0.66, h: 0.06, label: "4" },
    ]
  },
  {
    id: "stores_main",
    path: "/stores",
    wait: 3000,
    annotations: [
      { x: 0.40, y: 0.10, w: 0.31, h: 0.06, label: "1" },
      { x: 0.43, y: 0.19, w: 0.28, h: 0.06, label: "2" },
      { x: 0.08, y: 0.27, w: 0.84, h: 0.06, label: "3" },
      { x: 0.75, y: 0.10, w: 0.24, h: 0.06, label: "4" },
    ]
  },
  {
    id: "defects_main",
    path: "/defects/active",
    wait: 3000,
    annotations: [
      { x: 0.06, y: 0.14, w: 0.30, h: 0.06, label: "1" },
      { x: 0.08, y: 0.22, w: 0.88, h: 0.65, label: "2" },
      { x: 0.73, y: 0.10, w: 0.08, h: 0.06, label: "3" },
      { x: 0.82, y: 0.10, w: 0.07, h: 0.06, label: "4" },
      { x: 0.89, y: 0.10, w: 0.10, h: 0.06, label: "5" },
    ]
  },
  {
    id: "defects_coc",
    path: "/defects/coc",
    wait: 3000,
    annotations: [
      { x: 0.08, y: 0.12, w: 0.54, h: 0.06, label: "1" },
      { x: 0.08, y: 0.22, w: 0.88, h: 0.65, label: "2" },
      { x: 0.89, y: 0.10, w: 0.10, h: 0.06, label: "3" },
    ]
  },
  {
    id: "certificates_main",
    path: "/cert-surveys/certificates",
    wait: 3000,
    annotations: [
      { x: 0.08, y: 0.15, w: 0.54, h: 0.06, label: "1" },
      { x: 0.10, y: 0.22, w: 0.86, h: 0.65, label: "2" },
      { x: 0.84, y: 0.10, w: 0.15, h: 0.06, label: "3" },
    ]
  },
  {
    id: "surveys_main",
    path: "/cert-surveys/surveys",
    wait: 3000,
    annotations: [
      { x: 0.08, y: 0.15, w: 0.54, h: 0.06, label: "1" },
      { x: 0.10, y: 0.22, w: 0.86, h: 0.65, label: "2" },
      { x: 0.84, y: 0.10, w: 0.15, h: 0.06, label: "3" },
    ]
  },
  {
    id: "reports_main",
    path: "/reports",
    wait: 3000,
    annotations: [
      { x: 0.08, y: 0.17, w: 0.58, h: 0.06, label: "1" },
      { x: 0.08, y: 0.26, w: 0.91, h: 0.65, label: "2" },
      { x: 0.70, y: 0.10, w: 0.29, h: 0.06, label: "3" },
    ]
  },
  {
    id: "admin_main",
    path: "/admin/masters",
    wait: 3000,
    annotations: [
      { x: 0.08, y: 0.26, w: 0.25, h: 0.60, label: "1" },
      { x: 0.35, y: 0.26, w: 0.63, h: 0.60, label: "2" },
      { x: 0.87, y: 0.10, w: 0.12, h: 0.06, label: "3" },
    ]
  },
  {
    id: "modifypms_main",
    path: "/pms/modify-pms",
    wait: 3000,
    annotations: [
      { x: 0.08, y: 0.24, w: 0.16, h: 0.50, label: "1" },
      { x: 0.28, y: 0.17, w: 0.54, h: 0.06, label: "2" },
      { x: 0.82, y: 0.10, w: 0.17, h: 0.06, label: "3" },
    ]
  },
];

function h1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 36, font: "Calibri", color: "1E5A8E" })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
  });
}
function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 30, font: "Calibri", color: "2E75B6" })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
  });
}
function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, font: "Calibri", color: "404040" })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
  });
}
function para(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Calibri" })],
    spacing: { after: 120 },
  });
}
function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Calibri" })],
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}
function note(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: "Note: ", bold: true, size: 22, font: "Calibri", color: "D4A017" }),
      new TextRun({ text, size: 22, font: "Calibri" }),
    ],
    spacing: { before: 100, after: 120 },
  });
}
function figCaption(text) {
  return new Paragraph({
    children: [new TextRun({ text, italics: true, size: 20, font: "Calibri", color: "555555" })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

async function imageBlock(filePath) {
  const imgBuf = fs.readFileSync(filePath);
  const meta = await sharp(filePath).metadata();
  const maxW = 600;
  const scale = maxW / meta.width;
  const w = maxW;
  const h = Math.round(meta.height * scale);
  return new Paragraph({
    children: [new ImageRun({ data: imgBuf, transformation: { width: w, height: h }, type: "png" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 150, after: 80 },
  });
}

async function captureScreenshots() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--ignore-certificate-errors"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  for (const spec of screenshotSpecs) {
    const rawPath = path.join(SS_DIR, `${spec.id}_raw.png`);
    const annoPath = path.join(SS_DIR, `${spec.id}.png`);

    console.log(`  Capturing ${spec.id} -> ${spec.path}`);
    try {
      await page.goto(`${BASE_URL}${spec.path}`, { waitUntil: "networkidle2", timeout: 30000 });
    } catch (e) {
      console.log(`    Warning: navigation timeout, continuing...`);
    }
    await new Promise(r => setTimeout(r, spec.wait || 2000));
    await page.screenshot({ path: rawPath, fullPage: false });

    console.log(`  Annotating ${spec.id}...`);
    await annotateImage(rawPath, annoPath, spec.annotations);
  }

  await browser.close();
  console.log("All screenshots captured and annotated.");
}

async function buildDocument() {
  console.log("Building Word document...");

  const sections = [];

  sections.push(
    new Paragraph({ spacing: { before: 3000 } }),
    new Paragraph({
      children: [new TextRun({ text: "SAIL – PMS Module", bold: true, size: 52, font: "Calibri", color: "1E5A8E" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "User Manual", bold: true, size: 52, font: "Calibri", color: "1E5A8E" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Planned Maintenance System", size: 28, font: "Calibri", color: "444444" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Comprehensive User Guide for Ship Management Operations", size: 24, font: "Calibri", color: "666666" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Version 1.0", size: 22, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, size: 22, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
    }),
    pageBreak(),
  );

  const toc = [
    "1.1  Dashboard",
    "  1.1.1  Filters",
    "  1.1.2  Overview Tab",
    "  1.1.3  Management Tab",
    "1.2  Components",
    "  1.2.1  Opening Screen",
    "  1.2.2  Search and Filter",
    "  1.2.3  Component Details",
    "  1.2.4  How to Add / Edit a Component",
    "  1.2.5  How to Export Components",
    "  1.2.6  Modify Mode / Change Requests",
    "1.3  Work Orders",
    "  1.3.1  Opening Screen",
    "  1.3.2  Status Tabs",
    "  1.3.3  Filters",
    "  1.3.4  How to Create an Unplanned Work Order",
    "  1.3.5  How to Postpone a Work Order",
    "  1.3.6  How to Approve / Reject a Work Order",
    "  1.3.7  How to Export Work Orders",
    "1.4  Running Hours",
    "  1.4.1  Opening Screen",
    "  1.4.2  How to Update Running Hours",
    "  1.4.3  How to Perform Bulk Update",
    "  1.4.4  Running Hours History",
    "1.5  Spares (Inventory)",
    "  1.5.1  Opening Screen",
    "  1.5.2  How to Add a Spare Part",
    "  1.5.3  How to Consume / Receive Spares",
    "  1.5.4  How to Export Spares",
    "1.6  Stores",
    "  1.6.1  Opening Screen",
    "  1.6.2  Categories",
    "  1.6.3  How to Add / Receive / Consume Store Items",
    "1.7  Defects",
    "  1.7.1  Defect Log",
    "  1.7.2  How to Report a New Defect",
    "  1.7.3  How to Close and Verify a Defect",
    "  1.7.4  Condition of Class (CoC)",
    "1.8  Certificates & Surveys",
    "  1.8.1  Certificates",
    "  1.8.2  Surveys",
    "  1.8.3  How to Edit and Manage Attachments",
    "1.9  Reports",
    "  1.9.1  Opening Screen",
    "  1.9.2  How to Generate and Export Reports",
    "1.10  Admin",
    "  1.10.1  Data Masters",
    "  1.10.2  How to Sync Master Data",
    "1.11  Modify PMS",
    "  1.11.1  Change Requests",
    "  1.11.2  How to Create a Change Request",
  ];

  sections.push(h1("Table of Contents"), new Paragraph({ spacing: { after: 200 } }));
  for (const t of toc) sections.push(para(t));
  sections.push(pageBreak());

  sections.push(
    h1("1.1  Dashboard"),
    para("The Dashboard provides a real-time overview of maintenance performance across the fleet or for a specific vessel. It is divided into three columns displaying Work Order KPIs, Status Trends, and Inventory metrics."),
    await imageBlock(path.join(SS_DIR, "dashboard_overview.png")),
    figCaption("Figure 1.1 – Dashboard Overview. (1) Work Order KPIs column, (2) Work Order Status & Trends column, (3) Inventory & Fleet Analysis column."),
    pageBreak(),

    h2("1.1.1  Filters"),
    para("The top bar provides navigation and filter controls for the Dashboard."),
    await imageBlock(path.join(SS_DIR, "dashboard_filters.png")),
    figCaption("Figure 1.1.1 – Dashboard Filters. (1) Vessel Selector, (2) Overview / Management tabs, (3) All Vessel / My Vessel toggle, (4) Current Year."),
    bullet("(1) Vessel Selector – Choose a specific vessel to view its data."),
    bullet("(2) Overview / Management – Switch between operational KPIs and fleet benchmarking."),
    bullet("(3) All Vessel / My Vessel – Toggle between fleet-wide aggregated view and your assigned vessels."),
    bullet("(4) Current Year – Displays the active year for the dashboard data."),

    h2("1.1.2  Overview Tab"),
    para("The Overview tab is the default view organized into three columns:"),
    bullet("Column 1 – Work Order KPIs: Semi-circle gauges for Overdue WOs, Completion Rate, and Outstanding Tasks."),
    bullet("Column 2 – Work Order Status & Trends: Status Distribution donut chart, 6-Month Maintenance Trend, and Overdue Work Orders table."),
    bullet("Column 3 – Inventory & Fleet Analysis: Quick stats (Total Spares, Low Stock, Critical Low Stock, Total Components, Stores Inventory), Spares Stock Status chart, and Vessel/Group Analysis dot matrix."),
    note("Click on any gauge or chart segment to navigate directly to the corresponding filtered view."),

    h2("1.1.3  Management Tab"),
    para("Displays a fleet-wide benchmarking table ranking all vessels by Overdue %, Outstanding %, Compliance %, and Low Stock. Sortable by any column."),
    pageBreak(),
  );

  sections.push(
    h1("1.2  Components"),
    para("The Components module displays the vessel equipment hierarchy in a tree structure following the SFI coding system."),

    h2("1.2.1  Opening Screen"),
    await imageBlock(path.join(SS_DIR, "components_main.png")),
    figCaption("Figure 1.2.1 – Components Opening Screen. (1) Component Tree (left panel), (2) Component Details (right panel)."),
    bullet("(1) Component Tree – Hierarchical navigation of equipment categories (1-8). Click to expand; click a component to view details."),
    bullet("(2) Component Details – Full information for the selected component."),

    h2("1.2.2  Search and Filter"),
    await imageBlock(path.join(SS_DIR, "components_filters.png")),
    figCaption("Figure 1.2.2 – Components Search & Filter. (1) Vessel Selector, (2) Search Bar, (3) Critical Item Filter, (4) Export, (5) Add/Edit Component."),
    bullet("(1) Vessel Selector – Switch between vessels."),
    bullet("(2) Search – Filter by Name, SFI Code, Fleet Equipment Code, Maker, or Serial No."),
    bullet("(3) Critical Item – All Items, Critical Only, or Non-Critical."),
    bullet("(4) Export – Download component register as Excel."),
    bullet("(5) + Add / Edit Component – Open the component registration form."),

    h2("1.2.3  Component Details"),
    para("When a component is selected, the right panel shows collapsible sections:"),
    bullet("A. Component Information – Fleet Equipment Code/Name, Component Code/Name, Maker, Model, Serial No, Category, Criticality, Department."),
    bullet("B. Running Hours – Counter Type (Master/Inherited/None), Current RH, Last Updated."),
    bullet("C. Jobs – Maintenance tasks with Job Code, Title, Frequency, Due Date. \"Generate WO\" and \"Add Job\" available."),
    bullet("D. Maintenance History – Read-only log of completed work orders."),
    bullet("E. Spares – Linked spare parts with current ROB."),

    h2("1.2.4  How to Add / Edit a Component"),
    para("Step 1: Click \"+ Add / Edit Component\" (top-right)."),
    para("Step 2: Fill required fields: Component Code, Name, Parent, Department."),
    para("Step 3: Click \"Save\"."),

    h2("1.2.5  How to Export Components"),
    para("Click \"Export\" to download the full component register as Excel."),

    h2("1.2.6  Modify Mode / Change Requests"),
    para("Step 1: Navigate to \"Modify PMS\" from side menu, select a component."),
    para("Step 2: Edit fields inline — changed values highlighted in red."),
    para("Step 3: Click \"Review & Submit\" in the sticky footer."),
    pageBreak(),
  );

  sections.push(
    h1("1.3  Work Orders"),
    para("Manages all planned and unplanned maintenance tasks for the selected vessel."),

    h2("1.3.1  Opening Screen"),
    await imageBlock(path.join(SS_DIR, "workorders_main.png")),
    figCaption("Figure 1.3.1 – Work Orders. (1) Status Tabs, (2) Filters, (3) Work Order Table, (4) Export, (5) + Unplanned W.O."),
    bullet("(1) Status Tabs – Planned, Due, Overdue, Pending Approval, Completed (with count badges)."),
    bullet("(2) Filters – Vessel, Search, Period (RH), Rank, Criticality."),
    bullet("(3) Work Order Table – Component, WO No, Job Title, Assigned To, Due Date, Status, Actions."),
    bullet("(4) Export – Download in Excel or PDF."),
    bullet("(5) + Unplanned W.O – Create new unplanned work order."),

    h2("1.3.2  Status Tabs"),
    await imageBlock(path.join(SS_DIR, "workorders_tabs.png")),
    figCaption("Figure 1.3.2 – Status Tabs. (1) Planned, (2) Due, (3) Overdue, (4) Pending Approval, (5) Completed."),
    bullet("(1) Planned – Active templates + postponed items."),
    bullet("(2) Due – Within warning window (≤30 days / ≤720 RH). Amber badge."),
    bullet("(3) Overdue – Past tolerance/grace period. Red badge."),
    bullet("(4) Pending Approval – Executed WOs awaiting review."),
    bullet("(5) Completed – Approved and finished."),

    h2("1.3.3  Filters"),
    bullet("Search – By Job Title, WO No, Template Code, or Execution ID."),
    bullet("Period – Due in next 250 / 500 / 1000 RH."),
    bullet("Rank – Filter by assigned rank."),
    bullet("Criticality – Critical or Non-Critical."),

    h2("1.3.4  How to Create an Unplanned Work Order"),
    para("Step 1: Click \"+ Unplanned W.O\" (top-right)."),
    para("Step 2: Select Component, enter Job Title, Task Type, Assigned To, Priority, Description."),
    para("Step 3: Click \"Create\"."),

    h2("1.3.5  How to Postpone a Work Order"),
    para("Step 1: Click timer icon in Actions column."),
    para("Step 2: Enter Reason, New Due Date, Authorization."),
    para("Step 3: Click \"Confirm\"."),

    h2("1.3.6  How to Approve / Reject a Work Order"),
    para("Step 1: Go to \"Pending Approval\" tab."),
    para("Step 2: Review WO details via edit icon."),
    para("Step 3: Click \"Approve\" or \"Reject\"."),

    h2("1.3.7  How to Export Work Orders"),
    para("Step 1: Click \"Export\" (top-right)."),
    para("Step 2: Choose:"),
    bullet("Export Component Jobs – All vessel jobs in Excel (.xlsx)."),
    bullet("Export All Work Orders – Full WO listing in Excel or PDF."),
    pageBreak(),
  );

  sections.push(
    h1("1.4  Running Hours"),
    para("Tracks cumulative operating hours for vessel equipment."),

    h2("1.4.1  Opening Screen"),
    await imageBlock(path.join(SS_DIR, "runninghours_main.png")),
    figCaption("Figure 1.4.1 – Running Hours. (1) Overview/History tabs, (2) Search & Utilization filter, (3) Component table, (4) Export, (5) Bulk Update RH."),
    bullet("(1) Overview / History – Current values vs. update audit trail."),
    bullet("(2) Search & Utilization Period – Filter by Component Name/Code; Weekly/Monthly/Quarterly/Yearly."),
    bullet("(3) Table – Name, Code, Category, Running Hours, Last Updated, Utilization Rate."),
    bullet("(4) Export – Download as CSV."),
    bullet("(5) + Bulk Update RH – Update multiple components at once."),

    h2("1.4.2  How to Update Running Hours"),
    para("Step 1: Click gear icon next to the component."),
    para("Step 2: Choose \"Set Total\" or \"Add Delta\"."),
    para("Step 3: Enter value and remarks → Click \"Save\"."),
    note("Updates cascade to child components with Inherited RH type."),

    h2("1.4.3  How to Perform Bulk Update"),
    para("Step 1: Click \"+ Bulk Update RH\"."),
    para("Step 2: Enter values for multiple components."),
    para("Step 3: Click \"Save All\"."),

    h2("1.4.4  Running Hours History"),
    para("Switch to \"History\" tab to view all RH updates with Date, Component, Previous/New RH, Delta, Updated By, Remarks. Filter by date range."),
    pageBreak(),
  );

  sections.push(
    h1("1.5  Spares (Inventory)"),
    para("Manages spare parts inventory including stock tracking and multi-location support."),

    h2("1.5.1  Opening Screen"),
    await imageBlock(path.join(SS_DIR, "spares_main.png")),
    figCaption("Figure 1.5.1 – Spares. (1) Component tree, (2) Spares table, (3) Inventory/Location/History tabs, (4) Search & Filters."),
    bullet("(1) Component Search – Navigate hierarchy to filter spares by equipment."),
    bullet("(2) Spares Table – Part Code, Name, Component, Number, Criticality, ROB, Min/Max, Stock Status."),
    bullet("(3) Tabs – Inventory, Location (by storage area), History (transaction ledger)."),
    bullet("(4) Filters – Search, Criticality, Stock (All/Low/Out of Stock)."),

    h2("1.5.2  How to Add a Spare Part"),
    para("Step 1: Click \"+ Add Spare\"."),
    para("Step 2: Enter Part Code, Name, Number, Component, Min/Max, Unit, Location quantities."),
    para("Step 3: Click \"Save\"."),

    h2("1.5.3  How to Consume / Receive Spares"),
    para("Step 1: Click Consume or Receive button next to the part."),
    para("Step 2: Enter quantity, date, optional WO reference."),
    para("Step 3: Click \"Confirm\"."),
    note("Consumption cannot exceed current ROB. Bulk Update available."),

    h2("1.5.4  How to Export Spares"),
    para("Click \"Export\" to download inventory as Excel."),
    pageBreak(),
  );

  sections.push(
    h1("1.6  Stores"),
    para("Manages consumable items in four categories: Stores, Lubes, Chemicals, Others."),

    h2("1.6.1  Opening Screen"),
    await imageBlock(path.join(SS_DIR, "stores_main.png")),
    figCaption("Figure 1.6.1 – Stores. (1) Category tabs, (2) View modes (Inventory/Location/History), (3) Item table, (4) Action buttons."),
    bullet("(1) Categories – Stores, Lubes, Chemicals, Others."),
    bullet("(2) View Modes – Inventory, Location, History."),
    bullet("(3) Table – Item Code, Name, Category, UOM, ROB, Min, Stock, Location, IHM, Actions."),
    bullet("(4) Actions – + Add Store, + Bulk Update Stores, Export."),

    h2("1.6.2  Categories"),
    bullet("Stores – General deck/engine stores."),
    bullet("Lubes – Lubricants and oils."),
    bullet("Chemicals – Onboard chemicals (Hazard Classification, UN Number, Flash Point)."),
    bullet("Others – Miscellaneous items."),

    h2("1.6.3  How to Add / Receive / Consume Store Items"),
    para("Add: Click \"+ Add Store\" → Fill Item Code, Name, IMPA Code, Category, Unit, Min Level → Click \"Save\"."),
    para("Receive / Consume: Click action button → Enter quantity, date, remarks → Click \"Confirm\"."),
    para("Bulk Update: Click \"+ Bulk Update Stores\" for multiple items."),
    pageBreak(),
  );

  sections.push(
    h1("1.7  Defects"),
    para("Tracks defects from reporting through resolution with a multi-part form workflow."),

    h2("1.7.1  Defect Log"),
    await imageBlock(path.join(SS_DIR, "defects_main.png")),
    figCaption("Figure 1.7.1 – Defect Log. (1) Filters, (2) Defect grid, (3) Export, (4) Filters panel, (5) + New Defect."),
    bullet("(1) Filters – Period, Search, Due/Overdue."),
    bullet("(2) Defect Table – ID, Vessel, Issue Date, Category, Component, Description, Target Date, Status, Priority."),
    bullet("(3) Export – CSV or Excel."),
    bullet("(4) Filters – Advanced filter panel."),
    bullet("(5) + New Defect – Start defect reporting wizard."),

    h2("1.7.2  How to Report a New Defect"),
    para("Step 1: Click \"+ New Defect\" → Part A: Vessel, Date, Component, Category, Description, Severity, Attachments."),
    para("Step 2: Part B: Immediate Cause, Root Cause, Risk Level, Target Date."),
    para("Step 3: Click \"Save\"."),

    h2("1.7.3  How to Close and Verify a Defect"),
    para("Close (Part C): Open defect → Date Completed, Closed By → Click \"Submit\"."),
    para("Verify (Part D): Check verification box → Date Verified, Verified By → Click \"Submit\"."),

    h2("1.7.4  Condition of Class (CoC)"),
    await imageBlock(path.join(SS_DIR, "defects_coc.png")),
    figCaption("Figure 1.7.4 – CoC Defects. (1) CoC filters, (2) CoC defect grid, (3) + New CoC Defect."),
    para("Filters defects linked to class requirements with survey deadlines and compliance status."),
    pageBreak(),
  );

  sections.push(
    h1("1.8  Certificates & Surveys"),
    para("Tracks statutory and class compliance documentation with expiry alerts."),

    h2("1.8.1  Certificates"),
    await imageBlock(path.join(SS_DIR, "certificates_main.png")),
    figCaption("Figure 1.8.1 – Certificates. (1) Filters, (2) Certificate grid, (3) Export & Filters."),
    bullet("(1) Filters – Vessel/Fleet/Group, Due In (All/Overdue/Due 1-3 months)."),
    bullet("(2) Grid – Company ID, Name, Company Group, Vessel, Issue Date, Expiry Date, Last Annual, Actions."),
    bullet("(3) Export & Filters buttons."),
    note("Red = overdue; Amber = due within 60 days."),

    h2("1.8.2  Surveys"),
    await imageBlock(path.join(SS_DIR, "surveys_main.png")),
    figCaption("Figure 1.8.2 – Surveys. (1) Filters, (2) Survey grid, (3) Export & Filters."),
    bullet("Columns: Company ID, Survey, Company Group, Vessel, Survey Date, Due Date, 1st/2nd Range Dates."),

    h2("1.8.3  How to Edit and Manage Attachments"),
    para("Edit: Click a date cell → Use inline date picker → Changes auto-save."),
    para("Attachments: Click paperclip icon → Upload PDF/images → View/download existing documents."),
    pageBreak(),
  );

  sections.push(
    h1("1.9  Reports"),
    para("Consolidated analytics and exportable reports across all PMS areas."),

    h2("1.9.1  Opening Screen"),
    await imageBlock(path.join(SS_DIR, "reports_main.png")),
    figCaption("Figure 1.9.1 – Reports. (1) Search & filters, (2) Report category cards, (3) Schedule & Export Queue."),
    bullet("(1) Filters – Vessel, Search, Date range."),
    bullet("(2) Report Cards – Maintenance Planner, Maintenance & Work Orders, Running Hours, Spares, Stores, IHM, Modify PMS, Critical Equipment, LSA/FFA."),
    bullet("(3) Schedule Reports & Export Queue."),

    h2("1.9.2  How to Generate and Export Reports"),
    para("Step 1: Click a report category card."),
    para("Step 2: Apply filters (Vessel, Department, Date Range)."),
    para("Step 3: Click \"Preview\" then \"Export\" (PDF or Excel)."),
    pageBreak(),
  );

  sections.push(
    h1("1.10  Admin"),
    para("System configuration and master data management (Admin roles only)."),

    h2("1.10.1  Data Masters"),
    await imageBlock(path.join(SS_DIR, "admin_main.png")),
    figCaption("Figure 1.10.1 – Data Masters. (1) Master categories, (2) Data table, (3) Sync All."),
    bullet("(1) Categories – Vessel Master, Vessel Type, Additional Group, Ports, Users, Fleet Group, Equipment Category, Defect Category, Defect Type."),
    bullet("(2) Data Table – Entries for the selected master."),
    bullet("(3) Sync All – Synchronize with external enterprise system."),

    h2("1.10.2  How to Sync Master Data"),
    para("Step 1: Click \"Sync All\" (top-right)."),
    para("Step 2: System syncs Vessels, Users, Ports, Fleet Groups."),
    para("Step 3: Confirmation shows records created/updated/unchanged."),
    note("Editable masters (Equipment/Defect categories) are local and not affected by sync."),
    pageBreak(),
  );

  sections.push(
    h1("1.11  Modify PMS"),
    para("Allows vessel staff to propose PMS data changes through a formal approval workflow."),

    h2("1.11.1  Change Requests"),
    await imageBlock(path.join(SS_DIR, "modifypms_main.png")),
    figCaption("Figure 1.11.1 – Modify PMS. (1) Category sidebar, (2) Status filters & search, (3) + New Change Request."),
    bullet("(1) Categories – Components, Jobs, Spares, Stores."),
    bullet("(2) Status Filters – All, Pending Approval, Approved, Rejected."),
    bullet("(3) + New Change Request – Start a new modification."),

    h2("1.11.2  How to Create a Change Request"),
    para("Step 1: Click \"+ New Change Request\"."),
    para("Step 2: Select category and item to modify."),
    para("Step 3: Make changes (modified fields highlighted in red)."),
    para("Step 4: Submit for approval."),
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({ text: "SAIL – PMS Module User Manual", size: 18, font: "Calibri", color: "999999", italics: true })],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: "Page ", size: 18, font: "Calibri", color: "999999" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Calibri", color: "999999" }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children: sections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("SAIL_PMS_Module_User_Manual.docx", buffer);
  console.log(`\n✅ User Manual generated: SAIL_PMS_Module_User_Manual.docx`);
  console.log(`   File size: ${(buffer.length / 1024).toFixed(1)} KB`);
  console.log(`   Screenshots: ${screenshotSpecs.length} annotated images embedded`);
}

async function main() {
  await captureScreenshots();
  await buildDocument();
}

main().catch(err => { console.error("Error:", err); process.exit(1); });
