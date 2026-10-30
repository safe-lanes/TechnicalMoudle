import * as XLSX from "xlsx";
import { CLASS_REGULATORY_TEMPLATE_FIELDS } from "@shared/bulkImportTemplateFields";
import { classSurveyDay } from "@shared/classRegulatory";
import { ValidationError } from "../../shared/errors";

export const SECTION_H_IMPORT_TYPE = "class-regulatory";
export const SECTION_H_IMPORT_MAX_ROWS = 1000;
export type ImportMode = "add" | "update" | "upsert";
export type WorkbookRow = { row: number; values: Record<string, string>; errors: string[] };
export const headers = () => CLASS_REGULATORY_TEMPLATE_FIELDS.map(f => f.header);

/** Text must not pass through JS Date's locale or rollover conversions. */
export function importSurveyDate(value: string): string {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value) || !classSurveyDay(value))
    throw new Error("Use a valid calendar date in DD-MM-YYYY format");
  return value;
}

export function readSectionHWorkbook(buffer: Buffer, name: string, sheetName?: string) {
  if (!/\.(xlsx|xls)$/i.test(name)) throw new ValidationError("Upload an Excel .xlsx or .xls workbook.");
  const signature = buffer.length >= 8 ? buffer.subarray(0, 8).toString("hex") : "";
  const biff = buffer.length >= 4 && [0x0809, 0x0409, 0x0209, 0x0009].includes(buffer.readUInt16LE(0));
  if (!signature.startsWith("504b0304") && signature !== "d0cf11e0a1b11ae1" && !biff)
    throw new ValidationError("Upload an actual Excel workbook, not a renamed CSV or text file.");
  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, cellNF: true }); }
  catch { throw new ValidationError("The Excel workbook could not be read. Upload a valid, unencrypted .xls or .xlsx file."); }
  const sheet = sheetName || workbook.SheetNames[0];
  if (!sheet || !workbook.Sheets[sheet]) throw new ValidationError("Select an existing worksheet.");
  const ws = workbook.Sheets[sheet];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  if (range.s.r !== 0 || range.e.c !== 9) throw new ValidationError("Use the downloaded ten-column template, with headers in row 1.");
  headers().forEach((header, column) => {
    if (String(ws[XLSX.utils.encode_cell({ r: 0, c: column })]?.v ?? "").trim() !== header)
      throw new ValidationError(`Column ${column + 1} must be "${header}".`);
  });
  // Bound scans as well as nonempty data rows; reject pathological worksheet ranges early.
  if (range.e.r > SECTION_H_IMPORT_MAX_ROWS)
    throw new ValidationError(`Maximum ${SECTION_H_IMPORT_MAX_ROWS} data rows per worksheet. Split this import into smaller files.`);
  const rows: WorkbookRow[] = [];
  for (let r = 1; r <= range.e.r; r++) {
    const values: Record<string, string> = {};
    const errors: string[] = [];
    CLASS_REGULATORY_TEMPLATE_FIELDS.forEach((field, c) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      let value = cell ? String(XLSX.utils.format_cell(cell)).trim() : "";
      if (cell?.f) errors.push(`${field.header}: formulas are not accepted; paste values instead.`);
      if ((c === 3 || c === 4) && cell?.t === "n") {
        const date = XLSX.SSF.parse_date_code(cell.v, { date1904: !!workbook.Workbook?.WBProps?.date1904 });
        value = date ? `${String(date.d).padStart(2, "0")}-${String(date.m).padStart(2, "0")}-${String(date.y).padStart(4, "0")}` : "INVALID";
      }
      values[field.key] = value;
    });
    if (Object.values(values).some(Boolean) || errors.length) rows.push({ row: r + 1, values, errors });
  }
  if (!rows.length) throw new ValidationError("The selected worksheet has no data rows.");
  return { sheet, rows };
}
