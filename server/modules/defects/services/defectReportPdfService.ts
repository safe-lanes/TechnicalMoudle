import puppeteer from "puppeteer";
import { format } from "date-fns";
import type { DefectReportPdfData } from "@shared/defectReportPdf";
import { getChromiumPath } from "./defectLogPdfService";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Convert editor markup to readable text, then escape it. This is not an HTML
// allowlist: no user-supplied markup is ever inserted into the document.
function renderValue(value: string): string {
  const entities: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  };
  const plain = value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? match;
      const code = entity[1].toLowerCase() === "x"
        ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : match;
    }).trim();
  return escapeHtml(plain || "-");
}

type Field = [label: string, value: string];
function fields(...items: Field[]): string {
  return `<div class="fields cols-${items.length}">${items.map(([label, value]) =>
    `<div class="field"><div class="label">${label}</div><div class="value">${renderValue(value)}</div></div>`,
  ).join("")}</div>`;
}

function section(title: string, subtitle = ""): string {
  return `<div class="section"><h2>${title}</h2>${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}</div>`;
}

export function buildDefectReportPdfHtml(data: DefectReportPdfData): string {
  const ext = data.targetDateExtension;
  const actionColumns = [
    ["Action Type", "actionType"], ["Description", "description"], ["Proposed By", "proposedBy"],
    ["Responsibility", "responsibility"], ["Due Date", "dueDate"], ["Status", "status"],
  ] as const;
  const actions = data.actions.length
    ? `<table><colgroup><col style="width:15%"><col style="width:30%"><col style="width:15%"><col style="width:15%"><col style="width:13%"><col style="width:12%"></colgroup>
      <thead><tr>${actionColumns.map(([label]) => `<th>${label}</th>`).join("")}</tr></thead>
      <tbody>${data.actions.map(action => `<tr>${actionColumns.map(([, key]) =>
        `<td>${renderValue(action[key])}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : '<p class="empty">No actions recorded</p>';

  return `<!doctype html><html><head><meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #2c3e50; font-size: 9.5pt; line-height: 1.3; }
    .report-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 5mm; border-bottom: .8mm solid #1e5a8e; padding-bottom: 2mm; margin-bottom: 6mm; }
    h1 { color: #1e5a8e; font-size: 18pt; margin: 0; }
    .report-id { font-size: 9pt; text-align: right; overflow-wrap: anywhere; }
    .section { break-inside: avoid; break-after: avoid; margin-top: 5mm; margin-bottom: 3mm; }
    h2 { color: #1e5a8e; font-size: 13pt; margin: 0; border-bottom: .5mm solid #1e5a8e; padding-bottom: 2mm; }
    .subtitle { color: #5a6c7d; font-size: 9pt; margin-top: 2mm; }
    h3 { font-size: 10pt; margin: 4mm 0 2mm; break-after: avoid; }
    .fields { display: grid; gap: 0; margin-bottom: 3mm; }
    .cols-1 { grid-template-columns: 1fr; }
    .cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .field { padding-right: 2mm; min-width: 0; }
    .label { color: #5a6c7d; font-size: 8pt; margin-bottom: 1mm; break-after: avoid; }
    .value, td { white-space: pre-wrap; overflow-wrap: anywhere; }
    table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8pt; margin: 2mm 0 6mm; }
    thead { display: table-header-group; }
    th, td { padding: 2mm; border: .1mm solid #e1e8ed; text-align: left; vertical-align: top; }
    th { background: #f7f9fc; }
    tr { break-inside: avoid; }
    .empty { color: #5a6c7d; font-size: 9pt; font-style: italic; margin: 2mm 0 6mm; }
    @page { size: A4 portrait; }
  </style></head><body>
    <div class="report-heading"><h1>DEFECT REPORT</h1><div class="report-id">Report ID: ${renderValue(data.reportId)}</div></div>
    ${section("PART A - REPORTING", "Describe what happened")}
    ${fields(["Vessel", data.vessel], ["Category", data.category], ["Date Observed", data.dateObserved])}
    ${fields(["Source", data.source], ["Component", data.component], ["Date Reported to Office", data.dateReportedToOffice])}
    ${fields(["Defect Category", data.defectCategory], ["Make", data.make], ["Date Registered in System", data.dateRegisteredInSystem])}
    ${fields(["Defect Type", data.defectType], ["Model", data.model], ["Target Date", data.targetDate])}
    ${fields(["Raised By", data.raisedBy], ["CoC / Critical", `CoC: ${data.isCoc ? "Yes" : "No"}, Critical: ${data.isCritical ? "Yes" : "No"}`], ["Date Closed", data.dateClosed])}
    ${fields(["Description", data.description])}
    ${section("PART B - ANALYSIS & ACTIONS")}
    <h3>B1. Cause Analysis</h3>
    ${fields(["Immediate Cause", data.immediateCause], ["Further Explanation", data.immediateCauseExplanation])}
    ${fields(["Root Cause", data.rootCause], ["Further Explanation", data.rootCauseExplanation])}
    <h3>B2. SIRE Reference</h3>
    ${fields(["SIRE Version", data.sireVersion], ["SIRE Reference", data.sireReference], ["SIRE Hardware Class", data.sireHardwareClass])}
    <h3>B3. Risk & Priority</h3>
    ${fields(["Risk Level", data.riskLevel], ["Priority", data.priority])}
    <h3>B4. Actions</h3>${actions}
    ${ext ? `<h3>B5. Target Date Extension</h3>
      ${fields(["Existing Target Date", ext.existingTargetDate], ["New Target Date", ext.newTargetDate])}
      ${fields(["Reason for Extension", ext.reasonForExtension])}
      ${fields(["Approved", ext.approved], ["Approval Date", ext.approvalDate])}
      ${fields(["Approver Comments", ext.approverComments])}` : ""}
    ${section("PART C - CLOSEOUT")}
    <h3>C1. Closeout</h3>
    ${fields(["Confirm Completed", data.confirmCompleted ? "Yes" : "No"], ["Date Completed", data.dateCompleted])}
    ${fields(["Closed By (Name)", data.closedByName], ["Closed By (Rank)", data.closedByRank])}
    <h3>C2. Verification</h3>
    ${fields(["Verified", data.verified ? "Yes" : "No"], ["Date Verified", data.dateVerified])}
    ${fields(["Verified By (Name)", data.verifiedByName], ["Verified By (Office Position)", data.verifiedByOfficePosition])}
  </body></html>`;
}

export async function generateDefectReportPdf(data: DefectReportPdfData): Promise<Uint8Array> {
  const browser = await puppeteer.launch({ headless: true, executablePath: getChromiumPath() });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    // The report is self-contained: never fetch URLs embedded in editor content.
    await page.setRequestInterception(true);
    page.on("request", request => { void request.abort(); });
    await page.setContent(buildDefectReportPdfHtml(data), { waitUntil: "load", timeout: 30_000 });
    return await page.pdf({
      format: "A4", landscape: false, printBackground: true, timeout: 30_000,
      displayHeaderFooter: true, headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;margin:0 15mm;border-top:.1mm solid #e1e8ed;padding-top:2mm;font-family:Arial,Helvetica,sans-serif;font-size:8pt;color:#5a6c7d;display:flex;justify-content:space-between;">
        <span>SAIL</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      margin: { top: "10mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
  } finally {
    await browser.close();
  }
}

export function getDefectReportPdfFilename(reportId: string, date = new Date()): string {
  const safeId = reportId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Defect_Report_${safeId}_${format(date, "yyyyMMdd_HHmm")}.pdf`;
}
