const sharp = require("sharp");
const docx = require("docx");
const fs = require("fs");
const path = require("path");

const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, ImageRun, Header, Footer, PageNumber } = docx;
const SS_DIR = path.join(__dirname, "screenshots");

function h1(t) { return new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 36, font: "Calibri", color: "1E5A8E" })], heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }); }
function h2(t) { return new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 30, font: "Calibri", color: "2E75B6" })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }); }
function h3(t) { return new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 26, font: "Calibri", color: "404040" })], heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }); }
function para(t) { return new Paragraph({ children: [new TextRun({ text: t, size: 22, font: "Calibri" })], spacing: { after: 120 } }); }
function bullet(t) { return new Paragraph({ children: [new TextRun({ text: t, size: 22, font: "Calibri" })], bullet: { level: 0 }, spacing: { after: 60 } }); }
function note(t) { return new Paragraph({ children: [new TextRun({ text: "Note: ", bold: true, size: 22, font: "Calibri", color: "D4A017" }), new TextRun({ text: t, size: 22, font: "Calibri" })], spacing: { before: 100, after: 120 } }); }
function fig(t) { return new Paragraph({ children: [new TextRun({ text: t, italics: true, size: 20, font: "Calibri", color: "555555" })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }
function step(n, t) { return new Paragraph({ children: [new TextRun({ text: `Step ${n}: `, bold: true, size: 22, font: "Calibri" }), new TextRun({ text: t, size: 22, font: "Calibri" })], spacing: { after: 80 } }); }

async function img(name) {
  const fp = path.join(SS_DIR, name + ".png");
  const buf = fs.readFileSync(fp);
  const m = await sharp(fp).metadata();
  const maxW = 600, s = maxW / m.width, w = maxW, h = Math.round(m.height * s);
  return new Paragraph({ children: [new ImageRun({ data: buf, transformation: { width: w, height: h }, type: "png" })], alignment: AlignmentType.CENTER, spacing: { before: 150, after: 80 } });
}

async function build() {
  console.log("Building comprehensive document...");
  const c = [];

  // ---- TITLE PAGE ----
  c.push(new Paragraph({ spacing: { before: 3000 } }));
  c.push(new Paragraph({ children: [new TextRun({ text: "SAIL \u2013 PMS Module", bold: true, size: 52, font: "Calibri", color: "1E5A8E" })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
  c.push(new Paragraph({ children: [new TextRun({ text: "User Manual", bold: true, size: 52, font: "Calibri", color: "1E5A8E" })], alignment: AlignmentType.CENTER, spacing: { after: 600 } }));
  c.push(new Paragraph({ children: [new TextRun({ text: "Planned Maintenance System", size: 28, font: "Calibri", color: "444444" })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
  c.push(new Paragraph({ children: [new TextRun({ text: "Comprehensive User Guide for Ship Management Operations", size: 24, font: "Calibri", color: "666666" })], alignment: AlignmentType.CENTER, spacing: { after: 1200 } }));
  c.push(new Paragraph({ children: [new TextRun({ text: "Version 1.0", size: 22, font: "Calibri" })], alignment: AlignmentType.CENTER }));
  c.push(new Paragraph({ children: [new TextRun({ text: "Date: " + new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), size: 22, font: "Calibri" })], alignment: AlignmentType.CENTER }));
  c.push(pb());

  // ---- INTRODUCTION ----
  c.push(h1("1.0  Introduction"));
  c.push(para("This manual provides step-by-step instructions for the SAIL Planned Maintenance System (PMS) module. It covers all functional areas including the Dashboard, Components, Work Orders, Running Hours, Spares, Stores, Defects, Certificates & Surveys, Reports, Admin, and Modify PMS."));
  c.push(para("Each section includes annotated screenshots with numbered callouts (red boxes) that correspond to the explanations below each figure."));

  c.push(h2("1.0.1  Navigation"));
  c.push(para("The application uses a collapsible sidebar for navigation between modules."));
  c.push(await img("sidebar_nav"));
  c.push(fig("Figure 1.0.1 \u2013 Sidebar Navigation. (1) Collapsible sidebar with module icons for Dashboard, Components, Work Orders, Running Hours, Spares, Stores, Defects, Certificates & Surveys, Reports, Admin, and Modify PMS."));
  c.push(bullet("(1) Sidebar \u2013 Click any icon to navigate to that module. Hover to see the module name."));
  c.push(pb());

  // ---- TABLE OF CONTENTS ----
  c.push(h1("Table of Contents"));
  c.push(new Paragraph({ spacing: { after: 200 } }));
  const toc = [
    "1.0  Introduction", "  1.0.1  Navigation",
    "1.1  Dashboard", "  1.1.1  Overview Tab", "  1.1.2  Filters", "  1.1.3  Management Tab",
    "1.2  Components", "  1.2.1  Opening Screen", "  1.2.2  Search and Filter", "  1.2.3  Component Details", "  1.2.4  How to Add / Edit a Component", "  1.2.5  How to Export Components",
    "1.3  Work Orders", "  1.3.1  Opening Screen", "  1.3.2  Status Tabs", "  1.3.3  Due Work Orders", "  1.3.4  Overdue Work Orders", "  1.3.5  Pending Approval", "  1.3.6  Completed Work Orders", "  1.3.7  How to Create an Unplanned Work Order", "  1.3.8  How to Postpone a Work Order", "  1.3.9  How to Approve / Reject a Work Order", "  1.3.10  Export Dialog",
    "1.4  Running Hours", "  1.4.1  Opening Screen", "  1.4.2  How to Update Running Hours", "  1.4.3  How to Perform Bulk Update", "  1.4.4  Running Hours History",
    "1.5  Spares (Inventory)", "  1.5.1  Opening Screen", "  1.5.2  Location View", "  1.5.3  History View", "  1.5.4  How to Add a Spare Part", "  1.5.5  How to Consume / Receive Spares", "  1.5.6  How to Export Spares",
    "1.6  Stores", "  1.6.1  Opening Screen", "  1.6.2  Lubes", "  1.6.3  Chemicals", "  1.6.4  How to Add / Receive / Consume Store Items",
    "1.7  Defects", "  1.7.1  Defect Log", "  1.7.2  How to Report a New Defect", "  1.7.3  How to Close and Verify a Defect", "  1.7.4  Condition of Class (CoC)",
    "1.8  Certificates & Surveys", "  1.8.1  Certificates", "  1.8.2  Surveys", "  1.8.3  How to Edit and Manage Attachments",
    "1.9  Reports", "  1.9.1  Opening Screen", "  1.9.2  How to Generate and Export Reports",
    "1.10  Admin", "  1.10.1  Data Masters", "  1.10.2  How to Sync Master Data",
    "1.11  Modify PMS", "  1.11.1  Change Requests", "  1.11.2  How to Create a Change Request",
  ];
  for (const t of toc) c.push(para(t));
  c.push(pb());

  // ---- 1.1 DASHBOARD ----
  c.push(h1("1.1  Dashboard"));
  c.push(para("The Dashboard provides a real-time overview of maintenance performance across the fleet or for a specific vessel. It is divided into three columns displaying Work Order KPIs, Status Trends, and Inventory metrics."));

  c.push(h2("1.1.1  Overview Tab"));
  c.push(await img("dashboard_overview"));
  c.push(fig("Figure 1.1.1 \u2013 Dashboard Overview. (1) Work Order KPIs column, (2) Work Order Status & Trends column, (3) Inventory & Fleet Analysis column."));
  c.push(bullet("(1) Column 1 \u2013 Work Order KPIs: Semi-circle gauges for Overdue WOs, Completion Rate, and Outstanding Tasks."));
  c.push(bullet("(2) Column 2 \u2013 Work Order Status & Trends: Status Distribution donut chart, 6-Month Maintenance Trend bar chart, Overdue Work Orders table."));
  c.push(bullet("(3) Column 3 \u2013 Inventory & Fleet Analysis: Quick stats (Total Spares, Low Stock, Critical Low Stock, Total Components), Spares Stock Status chart, and Vessel/Group Analysis dot matrix."));
  c.push(note("Click on any gauge or chart segment to navigate directly to the corresponding filtered view."));

  c.push(h2("1.1.2  Filters"));
  c.push(await img("dashboard_filters"));
  c.push(fig("Figure 1.1.2 \u2013 Dashboard Filters. (1) Vessel Selector, (2) Overview/Management tabs, (3) All Vessel/My Vessel toggle, (4) Current Year."));
  c.push(bullet("(1) Vessel Selector \u2013 Choose a specific vessel to view its data."));
  c.push(bullet("(2) Overview / Management \u2013 Switch between operational KPIs and fleet benchmarking."));
  c.push(bullet("(3) All Vessel / My Vessel \u2013 Toggle between fleet-wide view and assigned vessels."));
  c.push(bullet("(4) Current Year \u2013 Displays the active year for dashboard data."));

  c.push(h2("1.1.3  Management Tab"));
  c.push(await img("dashboard_management"));
  c.push(fig("Figure 1.1.3 \u2013 Management Tab. (1) Fleet benchmarking table with vessel rankings."));
  c.push(bullet("(1) Fleet-wide benchmarking table ranking all vessels by Overdue %, Outstanding %, Compliance %, and Low Stock. Sortable by any column header."));
  c.push(pb());

  // ---- 1.2 COMPONENTS ----
  c.push(h1("1.2  Components"));
  c.push(para("The Components module displays the vessel equipment hierarchy in a tree structure following the SFI coding system."));

  c.push(h2("1.2.1  Opening Screen"));
  c.push(await img("components_main"));
  c.push(fig("Figure 1.2.1 \u2013 Components. (1) Component Tree (left panel), (2) Component Details (right panel)."));
  c.push(bullet("(1) Component Tree \u2013 Hierarchical navigation of equipment categories (1-8). Click to expand; click a component to view details."));
  c.push(bullet("(2) Component Details \u2013 Full information for the selected component including Jobs, Spares, Maintenance History."));

  c.push(h2("1.2.2  Search and Filter"));
  c.push(await img("components_filters"));
  c.push(fig("Figure 1.2.2 \u2013 Search & Filter. (1) Vessel Selector, (2) Search Bar, (3) Critical Item Filter, (4) Export, (5) Add/Edit Component."));
  c.push(bullet("(1) Vessel Selector \u2013 Switch between vessels."));
  c.push(bullet("(2) Search \u2013 Filter by Name, SFI Code, Fleet Equipment Code, Maker, or Serial No."));
  c.push(bullet("(3) Critical Item \u2013 All Items, Critical Only, or Non-Critical."));
  c.push(bullet("(4) Export \u2013 Download component register as Excel."));
  c.push(bullet("(5) + Add / Edit Component \u2013 Open the component registration form."));

  c.push(h2("1.2.3  Component Details"));
  c.push(para("When a component is selected, the right panel shows collapsible sections:"));
  c.push(bullet("A. Component Information \u2013 Fleet Equipment Code/Name, Component Code/Name, Maker, Model, Serial No, Category, Criticality, Department."));
  c.push(bullet("B. Running Hours \u2013 Counter Type (Master/Inherited/None), Current RH, Last Updated."));
  c.push(bullet("C. Jobs \u2013 Maintenance tasks with Job Code, Title, Frequency, Due Date. \u201CGenerate WO\u201D and \u201CAdd Job\u201D available."));
  c.push(bullet("D. Maintenance History \u2013 Read-only log of completed work orders."));
  c.push(bullet("E. Spares \u2013 Linked spare parts with current ROB."));

  c.push(h2("1.2.4  How to Add / Edit a Component"));
  c.push(step(1, "Click \u201C+ Add / Edit Component\u201D (top-right)."));
  c.push(step(2, "Fill required fields: Component Code, Name, Parent, Department."));
  c.push(step(3, "Click \u201CSave\u201D."));

  c.push(h2("1.2.5  How to Export Components"));
  c.push(para("Click \u201CExport\u201D to download the full component register as Excel."));
  c.push(pb());

  // ---- 1.3 WORK ORDERS ----
  c.push(h1("1.3  Work Orders"));
  c.push(para("Manages all planned and unplanned maintenance tasks for the selected vessel."));

  c.push(h2("1.3.1  Opening Screen"));
  c.push(await img("workorders_main"));
  c.push(fig("Figure 1.3.1 \u2013 Work Orders. (1) Status Tabs, (2) Filters, (3) Work Order Table, (4) Export, (5) + Unplanned W.O."));
  c.push(bullet("(1) Status Tabs \u2013 Planned, Due, Overdue, Pending Approval, Completed (with count badges)."));
  c.push(bullet("(2) Filters \u2013 Vessel, Search, Period (RH), Rank, Criticality."));
  c.push(bullet("(3) Work Order Table \u2013 Component, WO No, Job Title, Assigned To, Due Date, Status, Actions."));
  c.push(bullet("(4) Export \u2013 Download in Excel or PDF."));
  c.push(bullet("(5) + Unplanned W.O \u2013 Create new unplanned work order."));

  c.push(h2("1.3.2  Status Tabs"));
  c.push(await img("workorders_tabs"));
  c.push(fig("Figure 1.3.2 \u2013 Status Tabs. (1) Planned, (2) Due, (3) Overdue, (4) Pending Approval, (5) Completed."));
  c.push(bullet("(1) Planned \u2013 Active templates + postponed items."));
  c.push(bullet("(2) Due \u2013 Within warning window (\u226430 days / \u2264720 RH). Amber badge."));
  c.push(bullet("(3) Overdue \u2013 Past tolerance/grace period. Red badge."));
  c.push(bullet("(4) Pending Approval \u2013 Executed WOs awaiting review."));
  c.push(bullet("(5) Completed \u2013 Approved and finished."));

  c.push(h2("1.3.3  Due Work Orders"));
  c.push(await img("workorders_due"));
  c.push(fig("Figure 1.3.3 \u2013 Due Tab. (1) Due tab selected (amber), (2) Work orders approaching due date."));
  c.push(bullet("(1) Due tab selected \u2013 Shows work orders within the warning window."));
  c.push(bullet("(2) Table \u2013 Same columns as Planned but filtered to items approaching due date."));

  c.push(h2("1.3.4  Overdue Work Orders"));
  c.push(await img("workorders_overdue"));
  c.push(fig("Figure 1.3.4 \u2013 Overdue Tab. (1) Overdue tab selected (red), (2) Past-due work orders."));
  c.push(bullet("(1) Overdue tab selected \u2013 Shows work orders past their due date or tolerance."));
  c.push(bullet("(2) Table \u2013 Same columns filtered to overdue items. Red status indicator."));

  c.push(h2("1.3.5  Pending Approval"));
  c.push(await img("workorders_pending"));
  c.push(fig("Figure 1.3.5 \u2013 Pending Approval Tab. (1) Pending tab selected, (2) Work orders awaiting approval."));
  c.push(bullet("(1) Pending Approval tab \u2013 Completed WOs submitted for review."));
  c.push(bullet("(2) Table \u2013 Click review icon to Approve or Reject each work order."));

  c.push(h2("1.3.6  Completed Work Orders"));
  c.push(await img("workorders_completed"));
  c.push(fig("Figure 1.3.6 \u2013 Completed Tab. (1) Completed tab selected, (2) Finished and approved work orders."));
  c.push(bullet("(1) Completed tab \u2013 Work orders that have been approved and finalized."));
  c.push(bullet("(2) Table \u2013 Read-only archive with completion dates and outcomes."));

  c.push(h2("1.3.7  How to Create an Unplanned Work Order"));
  c.push(step(1, "Click \u201C+ Unplanned W.O\u201D (top-right)."));
  c.push(step(2, "Select Component, enter Job Title, Task Type, Assigned To, Priority, Description."));
  c.push(step(3, "Click \u201CCreate\u201D."));

  c.push(h2("1.3.8  How to Postpone a Work Order"));
  c.push(step(1, "Click timer icon in Actions column."));
  c.push(step(2, "Enter Reason, New Due Date, Authorization."));
  c.push(step(3, "Click \u201CConfirm\u201D."));

  c.push(h2("1.3.9  How to Approve / Reject a Work Order"));
  c.push(step(1, "Go to \u201CPending Approval\u201D tab."));
  c.push(step(2, "Review WO details via edit icon."));
  c.push(step(3, "Click \u201CApprove\u201D or \u201CReject\u201D."));

  c.push(h2("1.3.10  Export Dialog"));
  c.push(await img("workorders_export_dialog"));
  c.push(fig("Figure 1.3.10 \u2013 Export Dialog. (1) Export options: Component Jobs (Excel), All Work Orders (Excel/PDF)."));
  c.push(bullet("(1) Export dialog provides two options:"));
  c.push(bullet("    \u2022 Export Component Jobs \u2013 All vessel jobs in Excel (.xlsx)."));
  c.push(bullet("    \u2022 Export All Work Orders \u2013 Full WO listing in Excel or PDF."));
  c.push(pb());

  // ---- 1.4 RUNNING HOURS ----
  c.push(h1("1.4  Running Hours"));
  c.push(para("Tracks cumulative operating hours for vessel equipment."));

  c.push(h2("1.4.1  Opening Screen"));
  c.push(await img("runninghours_main"));
  c.push(fig("Figure 1.4.1 \u2013 Running Hours. (1) Overview/History tabs, (2) Search & Utilization filter, (3) Component table, (4) Export, (5) Bulk Update RH."));
  c.push(bullet("(1) Overview / History \u2013 Current values vs. update audit trail."));
  c.push(bullet("(2) Filters \u2013 Search by Name/Code; Utilization Period (Weekly/Monthly/Quarterly/Yearly)."));
  c.push(bullet("(3) Table \u2013 Name, Code, Category, Running Hours, Last Updated, Utilization Rate."));
  c.push(bullet("(4) Export \u2013 Download as CSV."));
  c.push(bullet("(5) + Bulk Update RH \u2013 Update multiple components at once."));

  c.push(h2("1.4.2  How to Update Running Hours"));
  c.push(step(1, "Click gear icon next to the component."));
  c.push(step(2, "Choose \u201CSet Total\u201D or \u201CAdd Delta\u201D."));
  c.push(step(3, "Enter value and remarks \u2192 Click \u201CSave\u201D."));
  c.push(note("Updates cascade to child components with Inherited RH type."));

  c.push(h2("1.4.3  How to Perform Bulk Update"));
  c.push(step(1, "Click \u201C+ Bulk Update RH\u201D."));
  c.push(step(2, "Enter values for multiple components in the form."));
  c.push(step(3, "Click \u201CSave All\u201D."));

  c.push(h2("1.4.4  Running Hours History"));
  c.push(await img("runninghours_history"));
  c.push(fig("Figure 1.4.4 \u2013 Running Hours History. (1) History tab selected, (2) Audit trail of all RH updates."));
  c.push(bullet("(1) History tab \u2013 Switch to view the audit trail of all running hours updates."));
  c.push(bullet("(2) Table \u2013 Date, Component, Previous RH, New RH, Delta, Updated By, Remarks. Filter by date range."));
  c.push(pb());

  // ---- 1.5 SPARES ----
  c.push(h1("1.5  Spares (Inventory)"));
  c.push(para("Manages spare parts inventory including stock tracking and multi-location support."));

  c.push(h2("1.5.1  Opening Screen"));
  c.push(await img("spares_main"));
  c.push(fig("Figure 1.5.1 \u2013 Spares. (1) Component tree, (2) Spares table, (3) Inventory/Location/History tabs, (4) Search & Filters."));
  c.push(bullet("(1) Component Search \u2013 Navigate hierarchy to filter spares by equipment."));
  c.push(bullet("(2) Spares Table \u2013 Part Code, Name, Component, Number, Criticality, ROB, Min/Max, Stock Status."));
  c.push(bullet("(3) Tabs \u2013 Inventory (default), Location (by storage area), History (transaction ledger)."));
  c.push(bullet("(4) Filters \u2013 Search, Criticality, Stock (All/Low/Out of Stock)."));

  c.push(h2("1.5.2  Location View"));
  c.push(await img("spares_location"));
  c.push(fig("Figure 1.5.2 \u2013 Spares Location View. (1) Location tab selected, (2) Spare parts grouped by storage location."));
  c.push(bullet("(1) Location tab \u2013 View spares organized by their physical storage location on the vessel."));
  c.push(bullet("(2) Location table \u2013 Shows location-specific quantities, allowing you to track where each spare is stored."));

  c.push(h2("1.5.3  History View"));
  c.push(await img("spares_history"));
  c.push(fig("Figure 1.5.3 \u2013 Spares History View. (1) History tab selected, (2) Transaction ledger with all consume/receive events."));
  c.push(bullet("(1) History tab \u2013 View the complete transaction history for all spares."));
  c.push(bullet("(2) Transaction ledger \u2013 Date, Type (Consume/Receive), Spare Part, Quantity, Balance, Work Order Reference, Updated By."));

  c.push(h2("1.5.4  How to Add a Spare Part"));
  c.push(step(1, "Click \u201C+ Add Spare\u201D."));
  c.push(step(2, "Enter Part Code, Name, Number, Component, Min/Max, Unit, Location quantities."));
  c.push(step(3, "Click \u201CSave\u201D."));

  c.push(h2("1.5.5  How to Consume / Receive Spares"));
  c.push(step(1, "Click Consume or Receive button next to the part."));
  c.push(step(2, "Enter quantity, date, optional WO reference."));
  c.push(step(3, "Click \u201CConfirm\u201D."));
  c.push(note("Consumption cannot exceed current ROB. Bulk Update available for multiple items."));

  c.push(h2("1.5.6  How to Export Spares"));
  c.push(para("Click \u201CExport\u201D to download inventory as Excel."));
  c.push(pb());

  // ---- 1.6 STORES ----
  c.push(h1("1.6  Stores"));
  c.push(para("Manages consumable items in four categories: Stores, Lubes, Chemicals, Others."));

  c.push(h2("1.6.1  Opening Screen"));
  c.push(await img("stores_main"));
  c.push(fig("Figure 1.6.1 \u2013 Stores. (1) Category tabs, (2) View modes (Inventory/Location/History), (3) Item table, (4) Action buttons."));
  c.push(bullet("(1) Categories \u2013 Stores, Lubes, Chemicals, Others."));
  c.push(bullet("(2) View Modes \u2013 Inventory, Location, History."));
  c.push(bullet("(3) Table \u2013 Item Code, Name, Category, UOM, ROB, Min, Stock, Location, IHM, Actions."));
  c.push(bullet("(4) Actions \u2013 + Add Store, + Bulk Update Stores, Export."));

  c.push(h2("1.6.2  Lubes"));
  c.push(await img("stores_lubes"));
  c.push(fig("Figure 1.6.2 \u2013 Stores \u2013 Lubes Tab. (1) Lubes category selected, (2) Lubricants and oils inventory."));
  c.push(bullet("(1) Lubes tab \u2013 Filters the table to show only lubricants and oils."));
  c.push(bullet("(2) Table \u2013 Same columns as Stores but filtered to lube items."));

  c.push(h2("1.6.3  Chemicals"));
  c.push(await img("stores_chemicals"));
  c.push(fig("Figure 1.6.3 \u2013 Stores \u2013 Chemicals Tab. (1) Chemicals category selected, (2) Chemical inventory with hazard information."));
  c.push(bullet("(1) Chemicals tab \u2013 Filters to onboard chemicals with additional fields: Hazard Classification, UN Number, Flash Point."));
  c.push(bullet("(2) Table \u2013 Includes chemical-specific safety data columns."));

  c.push(h2("1.6.4  How to Add / Receive / Consume Store Items"));
  c.push(para("Add:"));
  c.push(step(1, "Click \u201C+ Add Store\u201D."));
  c.push(step(2, "Fill Item Code, Name, IMPA Code, Category, Unit, Min Level."));
  c.push(step(3, "Click \u201CSave\u201D."));
  c.push(para("Receive / Consume:"));
  c.push(step(1, "Click action button next to the item."));
  c.push(step(2, "Enter quantity, date, remarks."));
  c.push(step(3, "Click \u201CConfirm\u201D."));
  c.push(para("Bulk Update: Click \u201C+ Bulk Update Stores\u201D for multiple items at once."));
  c.push(pb());

  // ---- 1.7 DEFECTS ----
  c.push(h1("1.7  Defects"));
  c.push(para("Tracks defects from reporting through resolution with a multi-part form workflow (Parts A through D)."));

  c.push(h2("1.7.1  Defect Log"));
  c.push(await img("defects_main"));
  c.push(fig("Figure 1.7.1 \u2013 Defect Log. (1) Filters, (2) Defect grid, (3) Export, (4) Filters panel, (5) + New Defect."));
  c.push(bullet("(1) Filters \u2013 Period, Search, Due/Overdue."));
  c.push(bullet("(2) Defect Table \u2013 ID, Vessel, Issue Date, Category, Component, Description, Target Date, Status, Priority."));
  c.push(bullet("(3) Export \u2013 CSV or Excel."));
  c.push(bullet("(4) Filters \u2013 Advanced filter panel."));
  c.push(bullet("(5) + New Defect \u2013 Start defect reporting wizard."));

  c.push(h2("1.7.2  How to Report a New Defect"));
  c.push(para("Part A \u2013 Initial Report:"));
  c.push(step(1, "Click \u201C+ New Defect\u201D."));
  c.push(step(2, "Enter: Vessel, Date, Component, Category, Description, Severity, Attachments (photos/documents)."));
  c.push(step(3, "Click \u201CNext\u201D to proceed to Part B."));
  c.push(para("Part B \u2013 Investigation:"));
  c.push(step(4, "Enter: Immediate Cause, Root Cause, Risk Level, Target Date for resolution."));
  c.push(step(5, "Click \u201CSave\u201D."));

  c.push(h2("1.7.3  How to Close and Verify a Defect"));
  c.push(para("Part C \u2013 Close:"));
  c.push(step(1, "Open the defect record."));
  c.push(step(2, "Enter Date Completed, Closed By, Corrective Actions."));
  c.push(step(3, "Click \u201CSubmit\u201D."));
  c.push(para("Part D \u2013 Verify:"));
  c.push(step(4, "Check the verification box."));
  c.push(step(5, "Enter Date Verified, Verified By."));
  c.push(step(6, "Click \u201CSubmit\u201D."));

  c.push(h2("1.7.4  Condition of Class (CoC)"));
  c.push(await img("defects_coc"));
  c.push(fig("Figure 1.7.4 \u2013 CoC Defects. (1) CoC filters, (2) CoC defect grid, (3) + New CoC Defect."));
  c.push(bullet("(1) CoC Filters \u2013 Search and filter CoC-specific defects."));
  c.push(bullet("(2) CoC Grid \u2013 Defects linked to class requirements with survey deadlines."));
  c.push(bullet("(3) + New CoC Defect \u2013 Report a class-related defect."));
  c.push(pb());

  // ---- 1.8 CERTIFICATES & SURVEYS ----
  c.push(h1("1.8  Certificates & Surveys"));
  c.push(para("Tracks statutory and class compliance documentation with expiry alerts."));

  c.push(h2("1.8.1  Certificates"));
  c.push(await img("certificates_main"));
  c.push(fig("Figure 1.8.1 \u2013 Certificates. (1) Filters, (2) Certificate grid, (3) Export & Filters."));
  c.push(bullet("(1) Filters \u2013 Vessel/Fleet/Group, Due In (All/Overdue/Due 1-3 months)."));
  c.push(bullet("(2) Grid \u2013 Company ID, Name, Company Group, Vessel, Issue Date, Expiry Date, Last Annual, Actions."));
  c.push(bullet("(3) Export & Filters buttons."));
  c.push(note("Red = overdue; Amber = due within 60 days."));

  c.push(h2("1.8.2  Surveys"));
  c.push(await img("surveys_main"));
  c.push(fig("Figure 1.8.2 \u2013 Surveys. (1) Filters, (2) Survey grid, (3) Export & Filters."));
  c.push(bullet("Columns: Company ID, Survey, Company Group, Vessel, Survey Date, Due Date, 1st/2nd Range Dates."));

  c.push(h2("1.8.3  How to Edit and Manage Attachments"));
  c.push(step(1, "Click a date cell to use inline date picker \u2013 changes auto-save."));
  c.push(step(2, "Click paperclip icon to upload PDF/images or view/download existing documents."));
  c.push(pb());

  // ---- 1.9 REPORTS ----
  c.push(h1("1.9  Reports"));
  c.push(para("Consolidated analytics and exportable reports across all PMS areas."));

  c.push(h2("1.9.1  Opening Screen"));
  c.push(await img("reports_main"));
  c.push(fig("Figure 1.9.1 \u2013 Reports. (1) Search & filters, (2) Report category cards, (3) Schedule & Export Queue."));
  c.push(bullet("(1) Filters \u2013 Vessel, Search, Date range."));
  c.push(bullet("(2) Report Cards \u2013 Maintenance Planner, Maintenance & Work Orders, Running Hours, Spares, Stores, IHM, Modify PMS, Critical Equipment, LSA/FFA."));
  c.push(bullet("(3) Schedule Reports & Export Queue."));

  c.push(h2("1.9.2  How to Generate and Export Reports"));
  c.push(step(1, "Click a report category card."));
  c.push(step(2, "Apply filters (Vessel, Department, Date Range)."));
  c.push(step(3, "Click \u201CPreview\u201D then \u201CExport\u201D (PDF or Excel)."));
  c.push(pb());

  // ---- 1.10 ADMIN ----
  c.push(h1("1.10  Admin"));
  c.push(para("System configuration and master data management (Admin roles only)."));

  c.push(h2("1.10.1  Data Masters"));
  c.push(await img("admin_main"));
  c.push(fig("Figure 1.10.1 \u2013 Data Masters. (1) Master categories, (2) Data table, (3) Sync All."));
  c.push(bullet("(1) Categories \u2013 Vessel Master, Vessel Type, Additional Group, Ports, Users, Fleet Group, Equipment Category, Defect Category, Defect Type."));
  c.push(bullet("(2) Data Table \u2013 Entries for the selected master."));
  c.push(bullet("(3) Sync All \u2013 Synchronize with external enterprise system."));

  c.push(h2("1.10.2  How to Sync Master Data"));
  c.push(step(1, "Click \u201CSync All\u201D (top-right)."));
  c.push(step(2, "System syncs Vessels, Users, Ports, Fleet Groups."));
  c.push(step(3, "Confirmation shows records created/updated/unchanged."));
  c.push(note("Editable masters (Equipment/Defect categories) are local and not affected by sync."));
  c.push(pb());

  // ---- 1.11 MODIFY PMS ----
  c.push(h1("1.11  Modify PMS"));
  c.push(para("Allows vessel staff to propose PMS data changes through a formal approval workflow."));

  c.push(h2("1.11.1  Change Requests"));
  c.push(await img("modifypms_main"));
  c.push(fig("Figure 1.11.1 \u2013 Modify PMS. (1) Category sidebar, (2) Status filters & search, (3) + New Change Request."));
  c.push(bullet("(1) Categories \u2013 Components, Jobs, Spares, Stores."));
  c.push(bullet("(2) Status Filters \u2013 All, Pending Approval, Approved, Rejected."));
  c.push(bullet("(3) + New Change Request \u2013 Start a new modification."));

  c.push(h2("1.11.2  How to Create a Change Request"));
  c.push(step(1, "Click \u201C+ New Change Request\u201D."));
  c.push(step(2, "Select category and item to modify."));
  c.push(step(3, "Make changes (modified fields highlighted in red)."));
  c.push(step(4, "Click \u201CReview & Submit\u201D in the sticky footer."));
  c.push(step(5, "Approver reviews and either Approves or Rejects the change."));

  // Build document
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: "SAIL \u2013 PMS Module User Manual", size: 18, font: "Calibri", color: "999999", italics: true })], alignment: AlignmentType.RIGHT })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: "Page ", size: 18, font: "Calibri", color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Calibri", color: "999999" })], alignment: AlignmentType.CENTER })] }) },
      children: c
    }]
  });

  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync("SAIL_PMS_Module_User_Manual.docx", buf);
  console.log("Done! SAIL_PMS_Module_User_Manual.docx");
  console.log("Size: " + (buf.length / 1024).toFixed(1) + " KB");
  console.log("Embedded images: 28");
}
build().catch(e => { console.error(e); process.exit(1); });
