const docx = require("docx");
const fs = require("fs");

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, TableOfContents, PageBreak, Tab,
  BorderStyle, Header, Footer, PageNumber, NumberFormat
} = docx;

function title(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 52, font: "Calibri", color: "1E5A8E" })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  });
}

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    style: "Heading1",
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
  });
}

function h3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
  });
}

function h4(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_4,
    spacing: { before: 200, after: 100 },
  });
}

function para(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Calibri" })],
    spacing: { after: 120 },
  });
}

function paraItalic(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Calibri", italics: true, color: "666666" })],
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

function bullet2(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Calibri" })],
    bullet: { level: 1 },
    spacing: { after: 60 },
  });
}

function screenshot(caption) {
  return new Paragraph({
    children: [new TextRun({ text: `[Screenshot: ${caption}]`, italics: true, size: 20, font: "Calibri", color: "2E75B6" })],
    spacing: { before: 150, after: 150 },
    alignment: AlignmentType.CENTER,
    border: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
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

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

const sections = [];

// ===== TITLE PAGE =====
sections.push(
  new Paragraph({ spacing: { before: 3000 } }),
  title("SAIL – PMS Module"),
  title("User Manual"),
  new Paragraph({ spacing: { after: 600 } }),
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

// ===== TABLE OF CONTENTS =====
sections.push(
  h1("Table of Contents"),
  new Paragraph({ spacing: { after: 200 } }),
  para("1.1  Dashboard"),
  para("  1.1.1  Filters"),
  para("  1.1.2  Overview Tab"),
  para("    1.1.2.1  Work Order KPIs"),
  para("    1.1.2.2  Work Order Status & Trends"),
  para("    1.1.2.3  Inventory & Fleet Analysis"),
  para("  1.1.3  Management Tab"),
  para("  1.1.4  Anomaly Detection"),
  para("1.2  Components"),
  para("  1.2.1  Opening Screen"),
  para("  1.2.2  Tree Navigation"),
  para("  1.2.3  Search and Filter"),
  para("  1.2.4  Component Details"),
  para("    1.2.4.1  Component Information"),
  para("    1.2.4.2  Running Hours & Condition Monitoring"),
  para("    1.2.4.3  Jobs"),
  para("    1.2.4.4  Maintenance History"),
  para("    1.2.4.5  Spares"),
  para("  1.2.5  How to Add / Edit a Component"),
  para("  1.2.6  How to Export Components"),
  para("  1.2.7  Modify Mode / Change Requests"),
  para("1.3  Work Orders"),
  para("  1.3.1  Opening Screen"),
  para("  1.3.2  Status Tabs"),
  para("  1.3.3  Filters"),
  para("  1.3.4  How to Create an Unplanned Work Order"),
  para("  1.3.5  How to Edit a Work Order"),
  para("  1.3.6  How to Postpone a Work Order"),
  para("  1.3.7  How to Approve / Reject a Work Order"),
  para("  1.3.8  How to Export Work Orders"),
  para("1.4  Running Hours"),
  para("  1.4.1  Opening Screen"),
  para("  1.4.2  How to Update Running Hours"),
  para("  1.4.3  How to Perform Bulk Update"),
  para("  1.4.4  How to Replace a Meter"),
  para("  1.4.5  Running Hours History"),
  para("  1.4.6  How to Export Running Hours"),
  para("1.5  Spares (Inventory)"),
  para("  1.5.1  Opening Screen"),
  para("  1.5.2  Inventory Tab"),
  para("  1.5.3  By-Location Tab"),
  para("  1.5.4  History Tab"),
  para("  1.5.5  How to Add a Spare Part"),
  para("  1.5.6  How to Consume / Receive Spares"),
  para("  1.5.7  How to Perform Bulk Update"),
  para("  1.5.8  How to Export Spares"),
  para("1.6  Stores"),
  para("  1.6.1  Opening Screen"),
  para("  1.6.2  Categories (Stores / Lubes / Chemicals / Others)"),
  para("  1.6.3  How to Add a Store Item"),
  para("  1.6.4  How to Receive / Consume Store Items"),
  para("  1.6.5  How to Export Stores"),
  para("1.7  Defects"),
  para("  1.7.1  Opening Screen"),
  para("  1.7.2  Defect Log"),
  para("  1.7.3  Filters"),
  para("  1.7.4  How to Report a New Defect"),
  para("  1.7.5  How to Close a Defect"),
  para("  1.7.6  How to Verify a Defect"),
  para("  1.7.7  Condition of Class (CoC)"),
  para("  1.7.8  Recurring Defects"),
  para("1.8  Certificates & Surveys"),
  para("  1.8.1  Certificates"),
  para("  1.8.2  Surveys"),
  para("  1.8.3  Filters"),
  para("  1.8.4  How to Edit Certificate / Survey Data"),
  para("  1.8.5  How to Manage Attachments"),
  para("1.9  Reports"),
  para("  1.9.1  Opening Screen"),
  para("  1.9.2  Report Categories"),
  para("  1.9.3  Maintenance Planner"),
  para("  1.9.4  How to Generate and Export Reports"),
  para("1.10  Admin"),
  para("  1.10.1  Opening Screen"),
  para("  1.10.2  Data Masters"),
  para("  1.10.3  How to Sync Master Data"),
  para("  1.10.4  User Management"),
  pageBreak(),
);

// ===== 1.1 DASHBOARD =====
sections.push(
  h1("1.1  Dashboard"),
  para("The Dashboard provides a comprehensive overview of the Planned Maintenance System (PMS) status. It serves as the central monitoring hub, presenting key performance indicators (KPIs), trends, and alerts for maintenance operations across the fleet or for a specific vessel."),
  para("The Dashboard supports two primary viewing modes:"),
  bullet("Fleet View (All Vessels): Aggregates data across all vessels for a high-level organizational overview, including benchmarking and KPI comparison."),
  bullet("Vessel Specific View (My Vessel): Displays detailed metrics filtered to a single selected vessel."),
  screenshot("Dashboard – Main Overview showing Work Order KPIs, Status Distribution, and Inventory Quick Stats"),
  pageBreak(),

  h2("1.1.1  Filters"),
  para("The top section of the Dashboard provides the following filter controls:"),

  h3("1.1.1.1  All Vessel / My Vessel"),
  para("All Vessel: Shows aggregated data for all vessels available in the organization."),
  para("My Vessel: Shows data for vessels assigned to the logged-in user. When selected, a vessel dropdown appears allowing you to choose a specific vessel."),
  para("You can toggle between All Vessel and My Vessel using the toggle control at the top of the Dashboard."),
  screenshot("Dashboard – All Vessel / My Vessel toggle and vessel selector dropdown"),

  h3("1.1.1.2  Overview / Management Tabs"),
  para("The Dashboard provides two main tabs for different perspectives:"),
  bullet("Overview: Displays operational KPIs, status distributions, trends, and inventory summaries."),
  bullet("Management: Provides a fleet-wide benchmarking table comparing vessels across key maintenance metrics."),
  screenshot("Dashboard – Tab switcher between Overview and Management views"),
  pageBreak(),

  h2("1.1.2  Overview Tab"),
  para("The Overview tab is organized into three functional columns providing a comprehensive snapshot of maintenance and inventory status."),

  h3("1.1.2.1  Work Order KPIs"),
  para("The left column displays critical maintenance performance metrics using semi-circle gauge visualizations:"),
  bullet("Overdue WOs: Count of work orders that have breached their due date beyond the tolerance/grace period. Displayed as a gauge with red indication."),
  bullet("Completion Rate: Percentage of planned maintenance tasks completed for the current month."),
  bullet("Outstanding Tasks: Percentage of remaining tasks (Active or Postponed) for the current month."),
  note("Clicking on any gauge will navigate you to the corresponding filtered view in the Work Orders page."),
  screenshot("Dashboard – Semi-circle gauge KPIs for Overdue WOs, Completion Rate, and Outstanding Tasks"),

  h3("1.1.2.2  Work Order Status & Trends"),
  para("The center column provides status distribution and trend analysis:"),
  bullet("Status Distribution (Donut Chart): Visualizes the breakdown of all work orders by their current status – Overdue, Due, Pending Approval, Completed, and Active/Postponed. Click on any segment to navigate to that specific status filter on the Work Orders page."),
  bullet("6-Month Maintenance Trend: A line/area chart tracking \"Completed %\", \"Outstanding %\", and \"Overdue %\" over the past six months. Hover over data points to see detailed tooltips."),
  bullet("Overdue Work Orders Table: Lists the top 5 most critical overdue tasks with quick links to view all overdue items or navigate to specific work order details."),
  screenshot("Dashboard – Status Distribution donut chart and 6-Month Maintenance Trend chart"),

  h3("1.1.2.3  Inventory & Fleet Analysis"),
  para("The right column displays inventory summaries and fleet-wide analysis:"),
  bullet("Inventory Quick Stats: Metric cards showing Total Spares, Low Stock items, Critical Low Stock items, Total Components, and Stores Inventory counts."),
  bullet("Spares Stock Status (Donut Chart): Breakdown of spare parts inventory into OK, Low Stock, and At Minimum levels."),
  bullet("Vessel / Group Analysis (Dot Matrix): A heatmap-style grid showing health indicators (Green/Amber/Red dots) for Work Orders, Overdue WOs, Low Stock, Spares, and Running Hours across multiple vessels."),
  bullet("Watchlist: A summary of the most critical items requiring attention, including top overdue work orders and critical low-stock spare parts."),
  screenshot("Dashboard – Inventory Quick Stats, Spares Stock Status chart, and Vessel/Group Analysis dot matrix"),
  pageBreak(),

  h2("1.1.3  Management Tab"),
  para("The Management tab provides a fleet-wide benchmarking view, available when viewing all vessels."),
  para("This tab displays a comprehensive table ranking all vessels across key maintenance performance indicators:"),
  bullet("Overdue %: Percentage of work orders that are overdue."),
  bullet("Outstanding %: Percentage of work orders still pending."),
  bullet("Compliance %: Overall maintenance compliance rate."),
  bullet("Low Stock: Count of spare parts below minimum reorder level."),
  para("The table is sortable by any column, allowing fleet managers to quickly identify vessels that require attention."),
  screenshot("Dashboard – Management Tab showing fleet benchmarking table with vessel KPIs"),

  h2("1.1.4  Anomaly Detection"),
  para("The Dashboard includes advanced analytical panels for detecting irregularities in maintenance and inventory data. These panels are visible to users with Sail Admin or Head of Department roles."),
  bullet("Compliance Anomaly Panel: Analyzes maintenance compliance patterns and flags potential issues such as irregular completion patterns or missing documentation."),
  bullet("Anomaly Detection Tile: Displays detected irregularities in maintenance or inventory data that may require investigation."),
  bullet("Superintendent Summary: A notification banner appearing at the top for pending approvals and acknowledgments."),
  note("The Anomaly Detection features are role-based and may not be visible to all users."),
  screenshot("Dashboard – Anomaly Detection panels and Superintendent notification banner"),
  pageBreak(),
);

// ===== 1.2 COMPONENTS =====
sections.push(
  h1("1.2  Components"),
  para("The Components module provides a hierarchical view of all vessel equipment organized in a tree structure following the SFI coding system. It allows users to view, search, add, edit, and manage components along with their associated jobs, spare parts, maintenance history, and running hours."),
  screenshot("Components – Main screen showing tree navigation (left) and component details (right)"),
  pageBreak(),

  h2("1.2.1  Opening Screen"),
  para("On entering the Components section, the screen is divided into two panels:"),
  bullet("Left Panel (30%): Displays the component hierarchy tree with 8 main categories (1 Ship General, 2 Hull, 3 Equipment for Cargo, 4 Ship's Equipment, 5 Equipment for Crew & Passengers, 6 Machinery Main Components, 7 Systems for Machinery Main Components, 8 Ship Common Systems)."),
  bullet("Right Panel (70%): Displays detailed information about the currently selected component."),
  para("The default view shows the tree in collapsed mode. Click on any category or component to expand and navigate the hierarchy."),
  screenshot("Components – Opening screen with collapsed tree and vessel selector"),

  h2("1.2.2  Tree Navigation"),
  para("The component tree allows hierarchical navigation through all vessel equipment:"),
  bullet("Expand/Collapse: Click the chevron (arrow) next to any node to expand or collapse its children."),
  bullet("Selection: Click on a component name to select it and load its details in the right panel."),
  bullet("Status Indicators: Inactive components appear greyed out with an \"(Inactive)\" label."),
  bullet("Edit Mode: Click the \"Edit\" button above the tree to enter drag-and-drop mode, which allows you to reorder components or change their parent (re-parenting)."),
  bullet("Expand/Collapse All: Use the \"Expand\" and \"Collapse\" buttons to expand or collapse the entire tree path of the selected component."),
  note("In Edit mode, you can drag a component to reorder it within its parent or move it to a different parent. Click \"Save\" to persist changes or \"Cancel\" to discard."),
  screenshot("Components – Tree navigation with expanded hierarchy showing expand/collapse and edit controls"),

  h2("1.2.3  Search and Filter"),
  para("The top bar provides search and filter controls for quickly locating components:"),
  bullet("Vessel Selector: Dropdown to switch between different vessels (visible to Admin/Client roles)."),
  bullet("Search Bar: Type to filter the tree by Component Name, SFI Code, Fleet Equipment Code, Maker, or Serial Number."),
  bullet("Critical Item Filter: Dropdown to filter by \"All Items\", \"Critical Only\", or \"Non-Critical\" components."),
  bullet("Clear: Button to reset all search and filter criteria."),
  screenshot("Components – Search bar and filter controls highlighted"),
  pageBreak(),

  h2("1.2.4  Component Details"),
  para("When a component is selected in the tree, its details are displayed in the right panel organized into collapsible sections."),

  h3("1.2.4.1  A. Component Information"),
  para("This section contains the primary metadata and technical specifications of the selected component:"),
  bullet("Fleet Equipment Code / Fleet Equipment Name"),
  bullet("Parent Component Code"),
  bullet("Component Code / Component Name"),
  bullet("Component Category"),
  bullet("Maker / Maker Code"),
  bullet("Model / Model Code"),
  bullet("Serial No / Drawing No"),
  bullet("Location"),
  bullet("Criticality (Yes/No)"),
  bullet("Condition Based (Yes/No)"),
  bullet("Installation Date / Commissioned Date"),
  bullet("Rating"),
  bullet("Equipment / System Department (Deck, Engine, Electrical, Galley, LSA, FFA)"),
  bullet("Class Item (Yes/No)"),
  bullet("IS Active (Yes/No)"),
  bullet("Vessel Code"),
  bullet("IS Parent (Yes/No)"),
  bullet("Notes"),
  screenshot("Components – Section A: Component Information showing all metadata fields"),

  h3("1.2.4.2  B. Running Hours & Condition Monitoring"),
  para("This section displays the current utilization data for the selected component:"),
  bullet("RH Counter Type: Indicates whether this component is a Master counter, Inherited from a parent, or Not RH Driven."),
  bullet("RH Counter Source: Shows the source of running hours data (Self or Parent component name)."),
  bullet("Running Hours: The current cumulative running hours value."),
  bullet("Last Updated: Date and time of the last running hours update."),
  screenshot("Components – Section B: Running Hours & Condition Monitoring panel"),

  h3("1.2.4.3  C. Jobs"),
  para("This section lists all maintenance jobs (tasks) associated with the selected component:"),
  bullet("Columns: Job Code, Job Title, Task Type, Frequency (Calendar interval or Running Hours), Last Done Date, Next Due Date."),
  bullet("Actions: Each job row has a \"Generate WO\" button to create an on-demand Work Order (with options: Planning, Breakdown, Other). An \"Add Job\" button at the bottom allows creating new job templates."),
  bullet("Navigation: Click on any job row to navigate to the detailed Job editing form."),
  note("The Jobs section shows a condensed view initially. Click \"Show More\" to expand and see all linked jobs. Pagination controls are available for components with many jobs."),
  screenshot("Components – Section C: Jobs table showing job list with Generate WO and Add Job buttons"),

  h3("1.2.4.4  D. Maintenance History"),
  para("This section displays a read-only audit trail of all completed maintenance work for the component:"),
  bullet("Columns: WO No, Title, Date Completed, RH at Completion, Performed By, Approved By."),
  para("Maintenance history records are immutable and cannot be edited or deleted once created."),
  screenshot("Components – Section D: Maintenance History log"),

  h3("1.2.4.5  E. Spares"),
  para("This section lists all spare parts associated with the selected component, showing part codes, names, and current ROB (Remaining On Board) quantities."),
  screenshot("Components – Section E: Linked spare parts list"),
  pageBreak(),

  h2("1.2.5  How to Add / Edit a Component"),
  para("To add a new component or edit an existing one:"),
  para("Step 1: Click the \"+ Add / Edit Component\" button in the top-right corner of the Components page."),
  para("Step 2: A full-page form opens with all component fields. Fill in the required fields (marked with *):"),
  bullet("Component Code (required)"),
  bullet("Component Name"),
  bullet("Parent Component (select from the tree)"),
  bullet("Equipment / System Department (required for child components)"),
  bullet("Maker and Maker Code"),
  bullet("Other technical specifications"),
  para("Step 3: Click \"Save\" to create the component or \"Cancel\" to discard changes."),
  note("When editing an existing component, click the \"Edit Component\" button displayed in the component details panel."),
  screenshot("Components – Add/Edit Component full-page form"),

  h2("1.2.6  How to Export Components"),
  para("To export the component register:"),
  para("Step 1: Click the \"Export\" button in the top-right area of the Components page."),
  para("Step 2: The system generates an Excel (.xlsx) file containing all components for the selected vessel with columns matching the import template format."),
  para("Step 3: The file is automatically downloaded to your device."),
  screenshot("Components – Export button location"),

  h2("1.2.7  Modify Mode / Change Requests"),
  para("The Modify Mode allows vessel staff to propose changes to component data that require shore-side approval:"),
  para("Step 1: Navigate to \"Modify PMS\" from the side menu."),
  para("Step 2: Select a component and make the desired changes. Modified fields are highlighted in red."),
  para("Step 3: A sticky footer appears at the bottom showing a summary of all pending changes."),
  para("Step 4: Click \"Review & Submit\" to open the Review Changes drawer, which displays all modifications for final review before submission."),
  para("Step 5: Submit the change request for approval by the shore-side team."),
  note("Change Requests follow a formal approval workflow. Submitted changes remain pending until approved or rejected by an authorized user."),
  screenshot("Components – Modify Mode with highlighted changes and Review & Submit footer"),
  pageBreak(),
);

// ===== 1.3 WORK ORDERS =====
sections.push(
  h1("1.3  Work Orders"),
  para("The Work Orders module manages all planned and unplanned maintenance tasks for the selected vessel. Work orders are categorized by status and provide tools for creating, executing, postponing, approving, and exporting maintenance tasks."),
  screenshot("Work Orders – Main screen showing the work order list with status tabs and filters"),
  pageBreak(),

  h2("1.3.1  Opening Screen"),
  para("On entering the Work Orders section, the screen displays:"),
  bullet("Status Tabs: Planned, Due, Overdue, Pending Approval, and Completed. Each tab shows a count badge."),
  bullet("Vessel Selector: Dropdown to select the vessel context."),
  bullet("Work Order Table: Lists work orders with columns for Component, Work Order No, Job Title, Assigned To, Due Date, Status, and Actions."),
  bullet("Pagination Controls: Navigate between pages with adjustable items per page (5, 10, 20, 50, 100)."),
  screenshot("Work Orders – Opening screen with Planned tab active"),

  h2("1.3.2  Status Tabs"),
  para("Work orders are organized into five status categories:"),
  bullet("Planned: Active work order templates not yet in the warning window, plus postponed items."),
  bullet("Due: Work orders within the warning window (≤30 days or ≤720 Running Hours) but not yet past due. Count shown in amber badge."),
  bullet("Overdue: Work orders that have breached their due date beyond the tolerance/grace period. Count shown in red badge."),
  bullet("Pending Approval: Executed work orders awaiting review and approval by the Superintendent/Head of Department."),
  bullet("Completed: Successfully finished and approved work orders."),
  screenshot("Work Orders – Status tabs showing count badges for each category"),

  h2("1.3.3  Filters"),
  para("The following filters are available to narrow down the work order list:"),
  bullet("Search: Text search by Job Title, Work Order Number, Template Code, or Execution ID."),
  bullet("Period (RH Filter): Filter by running hours proximity – \"Due in next 250 hours\", \"Due in next 500 hours\", \"Due in next 1000 hours\"."),
  bullet("Rank: Filter by the assigned rank (e.g., Chief Engineer, 2nd Engineer)."),
  bullet("Criticality: Filter by Critical or Non-Critical work orders."),
  bullet("Clear: Reset all filters to their default values."),
  screenshot("Work Orders – Filter controls highlighted"),
  pageBreak(),

  h2("1.3.4  How to Create an Unplanned Work Order"),
  para("To create a new unplanned work order:"),
  para("Step 1: Click the \"+ Unplanned W.O\" button in the top-right corner."),
  para("Step 2: A form opens with the following fields:"),
  bullet("Component: Select the component from the dropdown list."),
  bullet("Job Title: Enter a descriptive title for the maintenance task."),
  bullet("Task Type: Select the type of task (Inspection, Service, Overhaul, etc.)."),
  bullet("Assigned To: Select the responsible rank/person."),
  bullet("Priority: Set the priority level (Low, Medium, High, Critical)."),
  bullet("Description: Enter a detailed description of the work to be performed."),
  para("Step 3: Click \"Create\" to generate the work order or \"Cancel\" to discard."),
  note("Unplanned work orders are immediately added to the Planned tab with \"Active\" status."),
  screenshot("Work Orders – Unplanned Work Order creation form"),

  h2("1.3.5  How to Edit a Work Order"),
  para("To view or edit the details of a work order:"),
  para("Step 1: Click the pencil (edit) icon in the Actions column of the desired work order."),
  para("Step 2: The system navigates to the full Work Order detail page showing execution details, checklists, and completion information."),
  para("Step 3: Make the required changes and click \"Save\" to update."),
  screenshot("Work Orders – Edit work order detail page"),

  h2("1.3.6  How to Postpone a Work Order"),
  para("To postpone a work order to a later date:"),
  para("Step 1: Click the timer (postpone) icon in the Actions column of the work order."),
  para("Step 2: A postponement dialog opens requiring:"),
  bullet("Postpone Reason: Enter the reason for postponement."),
  bullet("New Due Date: Select the revised due date."),
  bullet("Authorization: Required approval reference."),
  para("Step 3: Click \"Confirm\" to postpone the work order."),
  note("Postponed work orders are moved to the Planned tab with a \"Postponed\" indicator. When the new due date arrives, the work order returns to the Due/Overdue status."),
  screenshot("Work Orders – Postponement dialog with reason and new due date fields"),

  h2("1.3.7  How to Approve / Reject a Work Order"),
  para("To approve or reject a completed work order (Superintendent / Head of Department):"),
  para("Step 1: Navigate to the \"Pending Approval\" tab."),
  para("Step 2: Review the completed work order details by clicking the edit icon."),
  para("Step 3: Click \"Approve\" to accept the work or \"Reject\" to send it back for corrections."),
  note("Bulk Approve is available from the Dashboard for Head of Department users, allowing multiple work orders to be approved simultaneously."),
  screenshot("Work Orders – Pending Approval tab with Approve/Reject action buttons"),

  h2("1.3.8  How to Export Work Orders"),
  para("To export work order data:"),
  para("Step 1: Click the \"Export\" button in the top-right area of the Work Orders page."),
  para("Step 2: An export dialog opens with two sections:"),
  bullet("Export Component Jobs: Downloads all jobs linked to components for the vessel in Excel format (.xlsx) with column headers matching the Jobs Import Sheet format."),
  bullet("Export All Work Orders: Downloads the complete work order listing with status, due dates, and assignments. Available in both Excel and PDF formats."),
  para("Step 3: Click the desired format button (Excel or PDF) to download the file."),
  screenshot("Work Orders – Export dialog showing Component Jobs and All Work Orders export options"),
  pageBreak(),
);

// ===== 1.4 RUNNING HOURS =====
sections.push(
  h1("1.4  Running Hours"),
  para("The Running Hours module tracks cumulative operating hours for vessel equipment. It supports individual and bulk updates, meter replacement workflows, cascading updates from parent to child components, and historical audit trails."),
  screenshot("Running Hours – Main screen showing component list with current RH values"),
  pageBreak(),

  h2("1.4.1  Opening Screen"),
  para("The Running Hours screen displays:"),
  bullet("Component List: A table of all components with Running Hours counters, showing Component Code, Name, Counter Type (Master/Inherited), Current RH, Last Updated date, and Utilization Rate."),
  bullet("Search Bar: Filter by Component Name or Code."),
  bullet("Utilization Period Filter: Toggle between Weekly, Monthly, Quarterly, and Yearly utilization views."),
  bullet("Action Buttons: \"Bulk Update\" and \"Export\" options in the header."),
  screenshot("Running Hours – Opening screen with search, filters, and component list"),

  h2("1.4.2  How to Update Running Hours"),
  para("To update the running hours for a single component:"),
  para("Step 1: Click the pencil (edit) icon next to the component in the Running Hours table."),
  para("Step 2: An edit dialog opens with two modes:"),
  bullet("Set Total: Enter the new total cumulative running hours value."),
  bullet("Add Delta: Enter the number of hours to add to the current total."),
  para("Step 3: Enter the new value and optional remarks."),
  para("Step 4: Click \"Save\" to update. The system validates that the new value is logical (e.g., not lower than the current total for Set Total mode)."),
  note("If the component has child components with \"Inherited\" RH type, the update will cascade automatically to those children."),
  screenshot("Running Hours – Single component update dialog with Set Total and Add Delta toggle"),

  h2("1.4.3  How to Perform Bulk Update"),
  para("To update running hours for multiple components at once:"),
  para("Step 1: Click the \"Bulk Update\" button in the header."),
  para("Step 2: A form displays all components with editable running hours fields."),
  para("Step 3: Enter the updated values for each component."),
  para("Step 4: Click \"Save All\" to apply all updates simultaneously."),
  screenshot("Running Hours – Bulk update form with multiple component inputs"),

  h2("1.4.4  How to Replace a Meter"),
  para("When physical running hour meters are replaced on equipment:"),
  para("Step 1: Select the component with the replaced meter."),
  para("Step 2: Activate the \"Meter Replacement\" feature."),
  para("Step 3: Enter the required information:"),
  bullet("Old Meter Final Reading: The last reading on the replaced meter."),
  bullet("New Meter Start Reading: The initial reading on the new meter (typically 0)."),
  para("Step 4: Click \"Confirm\" to record the meter replacement. The system maintains the cumulative RH history while accounting for the meter change."),
  screenshot("Running Hours – Meter replacement dialog"),

  h2("1.4.5  Running Hours History"),
  para("To view the audit trail of all running hours updates:"),
  para("Step 1: Switch to the \"History\" tab on the Running Hours page."),
  para("Step 2: The history log displays all update records with Date, Component, Previous RH, New RH, Change Delta, Updated By, and Remarks."),
  para("Step 3: Use the date range filter (From / To) to narrow the history view."),
  screenshot("Running Hours – History tab showing update audit trail with date filters"),

  h2("1.4.6  How to Export Running Hours"),
  para("Click the \"Export\" button to download the running hours data as a CSV file. Both the main component list and the history log can be exported."),
  screenshot("Running Hours – Export button and download options"),
  pageBreak(),
);

// ===== 1.5 SPARES =====
sections.push(
  h1("1.5  Spares (Inventory)"),
  para("The Spares module manages the spare parts inventory for the vessel, including stock tracking, consumption/receipt recording, multi-location management, and IHM (Inventory of Hazardous Materials) compliance tracking."),
  screenshot("Spares – Main screen showing inventory list with stock status indicators"),
  pageBreak(),

  h2("1.5.1  Opening Screen"),
  para("The Spares page displays three main tabs:"),
  bullet("Inventory: Master list of all spare parts with current stock levels."),
  bullet("By-Location: View spares grouped by physical storage locations on the vessel."),
  bullet("History: Transaction ledger showing all Receive, Consume, Transfer, and Adjust operations."),
  screenshot("Spares – Opening screen with tab navigation"),

  h2("1.5.2  Inventory Tab"),
  para("The Inventory tab shows all spare parts with the following information:"),
  bullet("Part Code / Part Name / Part Number"),
  bullet("Drawing Number"),
  bullet("Linked Component(s)"),
  bullet("ROB (Remaining On Board): Current stock quantity."),
  bullet("Min Level / Max Level: Reorder thresholds."),
  bullet("Stock Status: Visual indicators – Green (OK), Amber (Low Stock), Red (Out of Stock)."),
  para("Filters available:"),
  bullet("Search: Filter by Part Name, Code, Number, or Drawing Number."),
  bullet("Criticality: Filter by Critical or Non-Critical parts."),
  bullet("Stock Filter: All, Low Stock (ROB < Min), or Out of Stock (ROB = 0)."),
  bullet("Component Tree: Navigate hierarchically to filter spares by linked equipment."),
  screenshot("Spares – Inventory tab with search filters and stock status columns"),

  h2("1.5.3  By-Location Tab"),
  para("The By-Location tab organizes spare parts by their physical storage locations on the vessel (Location A and Location B). Custom location names can be assigned for each storage area."),
  screenshot("Spares – By-Location tab showing parts grouped by storage area"),

  h2("1.5.4  History Tab"),
  para("The History tab provides a complete transaction ledger showing all inventory movements:"),
  bullet("Transaction Types: Receive, Consume, Transfer, Adjust."),
  bullet("Columns: Date, Part Code, Part Name, Transaction Type, Quantity, Reference (Work Order), Remarks."),
  bullet("Date Range Filter: Filter history by From/To dates."),
  screenshot("Spares – History tab showing transaction ledger"),
  pageBreak(),

  h2("1.5.5  How to Add a Spare Part"),
  para("To register a new spare part:"),
  para("Step 1: Click the \"+ Add Spare\" button."),
  para("Step 2: Fill in the spare part details:"),
  bullet("Part Code / Part Name / Part Number (required)"),
  bullet("Drawing Number"),
  bullet("Linked Component(s)"),
  bullet("Min Level / Max Level / Unit of Measure"),
  bullet("Location A / Location B quantities"),
  bullet("IHM / Green Passport fields (if applicable)"),
  para("Step 3: Click \"Save\" to register the spare part."),
  screenshot("Spares – Add Spare Part modal form"),

  h2("1.5.6  How to Consume / Receive Spares"),
  para("To record a consumption or receipt:"),
  para("Step 1: Click the Consume or Receive quick-action button next to the spare part."),
  para("Step 2: Enter the quantity, date, and optional remarks."),
  para("Step 3: For consumption, optionally link the transaction to a Work Order for traceability."),
  para("Step 4: Click \"Confirm\" to update the ROB."),
  note("The system validates that consumption does not exceed the current ROB. Negative stock levels are not permitted."),
  screenshot("Spares – Consume/Receive dialog with quantity and work order reference fields"),

  h2("1.5.7  How to Perform Bulk Update"),
  para("To process multiple spare part transactions simultaneously:"),
  para("Step 1: Click the \"Bulk Update\" button."),
  para("Step 2: Select the transaction type (Receive or Consume)."),
  para("Step 3: Enter quantities for multiple spare parts in the bulk form."),
  para("Step 4: Click \"Save All\" to process all transactions at once."),
  screenshot("Spares – Bulk update form for multiple spare parts"),

  h2("1.5.8  How to Export Spares"),
  para("Click the \"Export\" button to download the spare parts inventory as an Excel file. The exported file includes all columns and current stock data."),
  screenshot("Spares – Export button location"),
  pageBreak(),
);

// ===== 1.6 STORES =====
sections.push(
  h1("1.6  Stores"),
  para("The Stores module manages consumable items on the vessel, organized into four categories: Stores (general deck/engine stores), Lubes (lubricants and oils), Chemicals (onboard chemicals), and Others (miscellaneous items)."),
  screenshot("Stores – Main screen showing inventory list with category tabs"),
  pageBreak(),

  h2("1.6.1  Opening Screen"),
  para("The Stores page provides a tabbed interface with three view modes:"),
  bullet("Inventory: Default list view showing all items in the selected category."),
  bullet("Location: Items organized by physical storage area."),
  bullet("History: Transaction ledger for the selected category."),
  screenshot("Stores – Opening screen with category tabs and view modes"),

  h2("1.6.2  Categories (Stores / Lubes / Chemicals / Others)"),
  para("Switch between store categories using the tab navigation at the top:"),
  bullet("Stores: General deck and engine stores."),
  bullet("Lubes: Lubricants and oils."),
  bullet("Chemicals: Onboard chemicals."),
  bullet("Others: Miscellaneous items."),
  para("Each category displays items with: Item Code, Name, IMPA Code, Unit, ROB, Min Level, and Stock Status."),
  para("Filters available: Search (Name, Code, or IMPA Code) and Stock Filter (In Stock, Low, Out of Stock)."),
  screenshot("Stores – Category tabs and item list with filters"),

  h2("1.6.3  How to Add a Store Item"),
  para("Step 1: Click \"+ Add Item\" in the header."),
  para("Step 2: Fill in the item details:"),
  bullet("Item Code / Item Name (required)"),
  bullet("IMPA Code"),
  bullet("Category selection"),
  bullet("Unit of Measure / Min Level"),
  bullet("Safety Data: Hazard Classification, UN Number, Flash Point (for chemicals)"),
  bullet("Shelf Life / Expiry Date"),
  bullet("IHM Presence (compliance tracking)"),
  para("Step 3: Click \"Save\" to add the item."),
  screenshot("Stores – Add Item form with safety data fields"),

  h2("1.6.4  How to Receive / Consume Store Items"),
  para("The process for receiving or consuming store items follows the same pattern as Spares:"),
  para("Step 1: Click the Receive or Consume action button next to the item."),
  para("Step 2: Enter quantity, date, and remarks."),
  para("Step 3: Click \"Confirm\" to update the stock."),
  para("Bulk Update is also available for processing multiple items simultaneously."),
  screenshot("Stores – Receive/Consume dialog"),

  h2("1.6.5  How to Export Stores"),
  para("Click \"Export\" to download the stores inventory as an Excel file for the selected category."),
  screenshot("Stores – Export button"),
  pageBreak(),
);

// ===== 1.7 DEFECTS =====
sections.push(
  h1("1.7  Defects"),
  para("The Defects module provides a comprehensive workflow for reporting, tracking, and resolving technical defects on the vessel. It supports a multi-part form structure covering defect description, root cause analysis, corrective action, and verification."),
  screenshot("Defects – Main screen showing defect log with status filters"),
  pageBreak(),

  h2("1.7.1  Opening Screen"),
  para("The Defects page displays a summary dashboard with:"),
  bullet("Active Defects: Count of currently open defects."),
  bullet("Overdue Defects: Count of defects past their target closure date."),
  bullet("Recurring Defects: Count of defects identified as recurring issues."),
  bullet("Defect Log Table: Comprehensive list with columns for Defect ID, Vessel, Date Observed, Component, Category, Severity, Status, Target Date, and Actions."),
  screenshot("Defects – Opening screen with summary metrics and defect log table"),

  h2("1.7.2  Defect Log"),
  para("The Defect Log uses an AG Grid table providing rich filtering, sorting, and data display capabilities. The log shows all defects for the selected vessel with color-coded status indicators."),
  screenshot("Defects – Defect Log AG Grid table with status indicators"),

  h2("1.7.3  Filters"),
  para("The following filters are available:"),
  bullet("Vessel / Fleet / Group Filter: Advanced selector for specific vessels or organizational groups."),
  bullet("Period Picker: Filter by Year, Quarter, Month, or custom Date Range."),
  bullet("Due/Overdue Filter: Options for \"All\", \"Overdue\", \"Due in 1 Month\", \"Due in 2 Months\"."),
  bullet("Category / Type: Filter by defect category (e.g., Machinery, Hull, Electrical)."),
  bullet("Search: Text-based search across defect descriptions and IDs."),
  screenshot("Defects – Filter controls with vessel selector and period picker"),
  pageBreak(),

  h2("1.7.4  How to Report a New Defect"),
  para("To create a new defect report:"),
  para("Step 1: Click \"+ New Defect\" button or navigate to the defect form wizard."),
  para("Step 2: Complete Part A – Description:"),
  bullet("Vessel and Date Observed"),
  bullet("Component (select from equipment hierarchy)"),
  bullet("Category and Type"),
  bullet("Description of the defect"),
  bullet("Severity level"),
  bullet("Attachments (photos, documents)"),
  para("Step 3: Complete Part B – Analysis:"),
  bullet("Immediate Cause"),
  bullet("Root Cause (with dedicated selection modals)"),
  bullet("Risk Level assessment"),
  bullet("Target Date for resolution"),
  para("Step 4: Click \"Save\" to submit the defect report."),
  note("Defect reports can be saved as drafts and completed later."),
  screenshot("Defects – New Defect form wizard showing Part A (Description) fields"),

  h2("1.7.5  How to Close a Defect"),
  para("Step 1: Open the defect record by clicking the View/Edit action."),
  para("Step 2: Navigate to Part C – Closeout:"),
  bullet("Confirm completion of corrective actions"),
  bullet("Enter Date Completed"),
  bullet("Enter Closed By (Name and Rank)"),
  para("Step 3: Click \"Submit\" to close the defect."),
  screenshot("Defects – Part C: Closeout section of the defect form"),

  h2("1.7.6  How to Verify a Defect"),
  para("Step 1: After a defect is closed, navigate to Part D – Verification:"),
  bullet("Check the verification checkbox to confirm the corrective action is effective"),
  bullet("Enter Date Verified"),
  bullet("Enter Verified By (Name and Position)"),
  para("Step 2: Click \"Submit\" to complete the verification."),
  note("Verification is role-based and may only be available to authorized users."),
  screenshot("Defects – Part D: Verification section"),

  h2("1.7.7  Condition of Class (CoC)"),
  para("The CoC sub-module specifically tracks defects linked to class requirements. Access the CoC view from the Defects sidebar menu to see only class-related defects with their survey deadlines and compliance status."),
  screenshot("Defects – Condition of Class (CoC) filtered view"),

  h2("1.7.8  Recurring Defects"),
  para("The Recurring Defects view identifies and tracks chronic technical issues that have occurred multiple times. The system automatically flags defects as recurring based on similar component, category, and description patterns."),
  screenshot("Defects – Recurring Defects view showing pattern analysis"),
  pageBreak(),
);

// ===== 1.8 CERTIFICATES & SURVEYS =====
sections.push(
  h1("1.8  Certificates & Surveys"),
  para("The Certificates & Surveys module tracks statutory and class compliance documentation for all vessels. It provides visual alerts for expiring or overdue items and supports attachment management for digital copies."),
  screenshot("Certificates & Surveys – Main screen showing certificate list"),
  pageBreak(),

  h2("1.8.1  Certificates"),
  para("The Certificates page displays all statutory and class certificates for the selected vessel:"),
  bullet("Columns: Certificate Name, Issuing Authority, Issue Date, Expiry Date, Endorsement Date, Status."),
  bullet("Visual Alerts: Red highlighting for overdue certificates, Amber for those due within 60 days."),
  bullet("Applicable Toggle: Checkbox to mark whether a certificate type is applicable to the vessel."),
  screenshot("Certificates – Certificate list with visual alerts and applicable toggles"),

  h2("1.8.2  Surveys"),
  para("The Surveys page tracks upcoming and completed surveys:"),
  bullet("Columns: Survey Name, Type, Survey Window (1st and 2nd Range Dates), Survey Date, Status."),
  bullet("Postponement Tracking: Records of any survey postponements with authorization details."),
  screenshot("Surveys – Survey list with window dates and status"),

  h2("1.8.3  Filters"),
  para("Both Certificates and Surveys share common filters:"),
  bullet("Vessel / Fleet / Group: Standard organizational filter."),
  bullet("Due In Filter: \"All\", \"Overdue\", \"Due in 1 Month\", \"Due in 2 Months\", \"Due in 3 Months\"."),
  screenshot("Certificates & Surveys – Filter controls"),

  h2("1.8.4  How to Edit Certificate / Survey Data"),
  para("Step 1: Click on the certificate or survey row in the table."),
  para("Step 2: The AG Grid provides inline editing for date fields using a custom date picker."),
  para("Step 3: Enter or update the Issue Date, Expiry Date, or Survey Date."),
  para("Step 4: Changes are auto-saved upon navigating away from the cell."),
  screenshot("Certificates & Surveys – Inline editing of dates using the date picker"),

  h2("1.8.5  How to Manage Attachments"),
  para("Step 1: Click the paperclip icon next to a certificate or survey record."),
  para("Step 2: An attachment panel opens allowing you to:"),
  bullet("Upload new documents (PDF, images, scanned copies)."),
  bullet("View existing attachments."),
  bullet("Download or delete attachments."),
  para("Step 3: Uploaded documents are linked to the specific certificate/survey record."),
  screenshot("Certificates & Surveys – Attachment management panel"),
  pageBreak(),
);

// ===== 1.9 REPORTS =====
sections.push(
  h1("1.9  Reports"),
  para("The Reports module provides consolidated analytics and document generation across all PMS areas. Reports are organized by category and can be exported in PDF or Excel formats."),
  screenshot("Reports – Main screen showing report categories"),
  pageBreak(),

  h2("1.9.1  Opening Screen"),
  para("The Reports page displays a card-based layout organized by report categories. Each card shows the report name, description, and available export formats."),
  screenshot("Reports – Opening screen with categorized report cards"),

  h2("1.9.2  Report Categories"),
  para("Reports are organized into the following categories:"),
  bullet("Maintenance & Work Orders: Due/Overdue jobs, Monthly maintenance summaries, Postponement logs, Job completion reports."),
  bullet("Running Hours & Condition: Utilization summaries, Anomaly detection reports."),
  bullet("Inventory (Spares/Stores): Low stock alerts, Consumption patterns, Critical spares reports."),
  bullet("Compliance: IHM (Inventory of Hazardous Materials) reports, Change Request logs, LSA/FFA equipment reports."),
  bullet("Certificates & Surveys: Compliance status reports, Expiry summaries."),
  screenshot("Reports – Report categories with individual report cards"),

  h2("1.9.3  Maintenance Planner"),
  para("The Maintenance Planner provides an interactive calendar and workload view:"),
  bullet("Calendar View: Monthly view of all scheduled maintenance tasks."),
  bullet("Workload Analysis: Distribution of tasks by rank showing assigned jobs, manhours, and completion rates."),
  bullet("Status Breakdown: Categorization by Due, Overdue, Completed, and Planned."),
  screenshot("Reports – Maintenance Planner with calendar and workload analysis views"),

  h2("1.9.4  How to Generate and Export Reports"),
  para("Step 1: Select the desired report from the categorized list."),
  para("Step 2: Apply global filters (Vessel, Department, Date Range, Priority) to narrow the report scope."),
  para("Step 3: Click \"Preview\" to view the report data in a modal before downloading."),
  para("Step 4: Click \"Export\" and select the desired format:"),
  bullet("PDF: Formatted document suitable for printing and sharing."),
  bullet("Excel: Spreadsheet format for data analysis."),
  para("Step 5: The file is automatically downloaded to your device."),
  screenshot("Reports – Export options showing PDF and Excel format buttons"),
  pageBreak(),
);

// ===== 1.10 ADMIN =====
sections.push(
  h1("1.10  Admin"),
  para("The Admin module provides system-wide configuration and master data management. It is accessible only to users with Sail Admin or Client Admin roles."),
  screenshot("Admin – Main screen showing configuration options"),
  pageBreak(),

  h2("1.10.1  Opening Screen"),
  para("The Admin page displays a sidebar with the following management options:"),
  bullet("Data Masters: Manage organizational reference data."),
  bullet("Ship's Certificates/Surveys Admin: Administrative oversight of compliance templates."),
  bullet("Fleet Component Editor: Define standard component templates at the fleet level."),
  bullet("PMS Settings: Configure maintenance parameters (lead times, tolerance periods, etc.)."),
  screenshot("Admin – Opening screen with sidebar navigation options"),

  h2("1.10.2  Data Masters"),
  para("The Data Masters section manages reference data used across the application:"),
  para("Standard Masters (read-only, synced from external system):"),
  bullet("Vessel Master: List of all vessels with their details."),
  bullet("Vessel Type: Classification of vessel types."),
  bullet("Additional Group: Organizational groupings."),
  bullet("Ports: Port reference database."),
  bullet("Users: User accounts with roles and designations."),
  bullet("Fleet Group: Fleet organizational structure."),
  para("Editable Masters (locally managed):"),
  bullet("Equipment Category: Categories for classifying equipment."),
  bullet("Defect Category: Categories for defect classification."),
  bullet("Defect Type: Types of defects for detailed categorization."),
  screenshot("Admin – Data Masters showing standard and editable master data tabs"),

  h2("1.10.3  How to Sync Master Data"),
  para("To synchronize local master data with the external enterprise system:"),
  para("Step 1: Click the \"Sync All\" button in the Data Masters section."),
  para("Step 2: The system connects to the external Master Fleet Management system and updates all standard master data (Vessels, Users, Ports, Fleet Groups)."),
  para("Step 3: A confirmation message shows the sync results including number of records created, updated, and unchanged."),
  note("Sync operations update standard masters only. Editable masters (Equipment/Defect categories) are managed locally and are not affected by sync."),
  screenshot("Admin – Sync All button and sync results confirmation"),

  h2("1.10.4  User Management"),
  para("User accounts are managed through the Users data master:"),
  bullet("View all system users with their roles, designations, and departments."),
  bullet("Role-based access control determines what each user can see and do in the system."),
  bullet("Key roles: Sail Admin (full access), Client Admin (organization-level management), Head of Department (vessel group management), Vessel User (operational access)."),
  screenshot("Admin – User management table with role assignments"),
);

// ===== BUILD DOCUMENT =====
const doc = new Document({
  styles: {
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        run: { size: 36, bold: true, font: "Calibri", color: "1E5A8E" },
        paragraph: { spacing: { before: 400, after: 200 } },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        run: { size: 30, bold: true, font: "Calibri", color: "2E75B6" },
        paragraph: { spacing: { before: 300, after: 150 } },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        run: { size: 26, bold: true, font: "Calibri", color: "404040" },
        paragraph: { spacing: { before: 200, after: 100 } },
      },
      {
        id: "Heading4",
        name: "Heading 4",
        basedOn: "Normal",
        next: "Normal",
        run: { size: 24, bold: true, font: "Calibri", color: "595959" },
        paragraph: { spacing: { before: 200, after: 100 } },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
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

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("SAIL_PMS_Module_User_Manual.docx", buffer);
  console.log("✅ User Guide generated: SAIL_PMS_Module_User_Manual.docx");
  console.log(`   File size: ${(buffer.length / 1024).toFixed(1)} KB`);
});
