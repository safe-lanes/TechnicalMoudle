import { existsSync } from "node:fs";
import puppeteer from "puppeteer";
import { format } from "date-fns";

export const DEFECT_LOG_PDF_COLUMNS = [
  "ID",
  "Vessel",
  "Issue Date",
  "Category",
  "Component",
  "Description",
  "Target Date",
  "Date Compl.",
  "Status",
  "Priority",
] as const;

export type DefectLogPdfRow = Partial<
  Record<(typeof DEFECT_LOG_PDF_COLUMNS)[number], string | number | null>
>;

const COLUMN_WIDTHS = ["12%", "10%", "9%", "7%", "10%", "19%", "9%", "9%", "9%", "6%"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined || value === "" ? "-" : String(value);
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

export function buildDefectLogPdfHtml(rows: DefectLogPdfRow[]): string {
  const colgroup = COLUMN_WIDTHS.map((width) => `<col style="width:${width}">`).join("");
  const head = DEFECT_LOG_PDF_COLUMNS.map((column) => `<th>${column}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = DEFECT_LOG_PDF_COLUMNS.map(
        (column) => {
          const value = row[column];
          const priorityClass =
            column === "Priority" && ["Critical", "High"].includes(String(value))
              ? ' class="priority-emphasis"'
              : "";
          return `<td${priorityClass}>${renderCell(value)}</td>`;
        },
      ).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      color: #2c3e50;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th, td {
      border: 0.1mm solid #e1e8ed;
      padding: 3pt;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
      white-space: normal;
      line-height: 1.25;
    }
    th {
      background: #ebeef0;
      color: #000;
      font-weight: 700;
    }
    .priority-emphasis { font-weight: 700; }
    @page { size: A4 landscape; }
  </style>
</head>
<body>
  <table aria-label="Defects Log">
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
}

export function getChromiumPath(): string {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/repl/tools/bin/chromium",
    puppeteer.executablePath(),
  ].filter((path): path is string => Boolean(path));
  const executablePath = candidates.find((path) => existsSync(path));

  if (!executablePath) {
    throw new Error("No permitted Chromium executable is available for PDF export.");
  }
  return executablePath;
}

function buildHeaderTemplate(rowCount: number, generatedAt: string): string {
  const totalLabel = `Total: ${rowCount} defect${rowCount === 1 ? "" : "s"}`;
  return `<div style="position:relative;width:100%;height:30mm;font-family:Arial,Helvetica,sans-serif;color:#2c3e50;">
    <div style="position:absolute;top:2mm;left:15mm;color:#1e5a8e;font-size:18px;font-weight:bold;">Defects Log</div>
    <div style="position:absolute;top:2mm;right:15mm;text-align:right;font-size:9px;line-height:1.5;">Vessel: All Vessels<br>Generated: ${escapeHtml(generatedAt)}</div>
    <div style="position:absolute;top:13mm;left:15mm;font-size:11px;">${totalLabel}</div>
    <div style="position:absolute;top:25mm;left:15mm;right:15mm;border-top:0.8mm solid #1e5a8e;"></div>
  </div>`;
}

const FOOTER_TEMPLATE = `<div style="width:100%;height:12mm;padding:2mm 15mm 0;border-top:0.1mm solid #e1e8ed;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:8px;color:#5a6c7d;display:flex;justify-content:space-between;">
  <span>SAIL</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

export async function generateDefectLogPdf(
  rows: DefectLogPdfRow[],
  generatedAt = format(new Date(), "dd MMM yyyy HH:mm"),
): Promise<Uint8Array> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: getChromiumPath(),
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildDefectLogPdfHtml(rows), { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(rows.length, generatedAt),
      footerTemplate: FOOTER_TEMPLATE,
      margin: {
        top: "32mm",
        right: "15mm",
        bottom: "15mm",
        left: "15mm",
      },
    });
  } finally {
    await browser.close();
  }
}

export function getDefectLogPdfFilename(date = new Date()): string {
  return `Defects_Log_${format(date, "yyyyMMdd_HHmm")}.pdf`;
}
