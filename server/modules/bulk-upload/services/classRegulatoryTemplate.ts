import ExcelJS from "exceljs";
import { and, eq, isNull, or } from "drizzle-orm";
import { masterLists } from "@shared/schema";
import { CLASS_REGULATORY_TEMPLATE_FIELDS } from "@shared/bulkImportTemplateFields";
import { getDb } from "../../../db";
import { importVessel } from "./classRegulatoryImport";

export async function classRegulatoryTemplate(vesselId: string) {
  const db = await getDb();
  const vessel = await importVessel(db, vesselId);
  const masters = await db.select().from(masterLists).where(and(eq(masterLists.isActive, true),
    or(isNull(masterLists.isDeleted), eq(masterLists.isDeleted, false))));
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Classification Regulatory");
  sheet.columns = CLASS_REGULATORY_TEMPLATE_FIELDS.map(f => ({ header: f.header, key: f.key,
    width: ["classRequirements", "information"].includes(f.key) ? 45 : 27 }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF52BAF3" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const column of [1, 2, 3, 6, 7, 8, 9, 10]) sheet.getColumn(column).numFmt = "@";
  sheet.getColumn(4).numFmt = "dd-mm-yyyy";
  sheet.getColumn(5).numFmt = "dd-mm-yyyy";
  const reference = workbook.addWorksheet("Master References");
  reference.columns = [
    { header: "Classification Society", width: 60 }, { header: "Class Code", width: 25 },
    { header: "Survey Type", width: 60 }, { header: "Survey Code", width: 25 },
  ];
  const societies = masters.filter(m => m.listType === "classificationSociety");
  const surveys = masters.filter(m => m.listType === "surveyType");
  for (let i = 0; i < Math.max(societies.length, surveys.length); i++)
    reference.addRow([societies[i]?.listValue, societies[i]?.listKey, surveys[i]?.listValue, surveys[i]?.listKey]);
  for (let row = 2; row <= 1001; row++) {
    if (societies.length) sheet.getCell(row, 2).dataValidation = { type: "list", allowBlank: true,
      formulae: [`'Master References'!$A$2:$A$${societies.length + 1}`], showErrorMessage: true, error: "Select an active Classification Society." };
    if (surveys.length) sheet.getCell(row, 6).dataValidation = { type: "list", allowBlank: true,
      formulae: [`'Master References'!$C$2:$C$${surveys.length + 1}`], showErrorMessage: true, error: "Select an active Survey Type." };
  }
  const guide = workbook.addWorksheet("Field Mapping Guide");
  guide.columns = [{ header: "Field", width: 28 }, { header: "Rule", width: 110 }];
  CLASS_REGULATORY_TEMPLATE_FIELDS.forEach(f => guide.addRow([f.header, f.description]));
  guide.addRow(["Selected vessel", `${vessel.name}; Vessel Code: ${vessel.code}. Enter this exact code in column J.`]);
  guide.addRow(["Matching", "Selected vessel + exact Component Code + exact Certificate Number (outer whitespace trimmed). No case/punctuation normalization."]);
  guide.addRow(["Blank updates", "Blank optional cells keep saved values. Clearing values is not supported by this import."]);
  guide.addRow(["Limits", "Maximum 1,000 worksheet data rows; Excel only. Import does not upload attachments. Undo is unavailable."]);
  guide.addRow(["Dates", "DD-MM-YYYY text or actual Excel date cells. Next survey must not precede last survey."]);
  guide.addRow(["Sync", "A completed import confirms shore persistence, not vessel delivery. Existing one-way sync delivers record changes."]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function classRegulatoryErrorWorkbook(rows: { row: number; errors: string[] }[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Validation Errors");
  sheet.columns = [{ header: "Excel Row", key: "row", width: 15 }, { header: "Error", key: "error", width: 120 }];
  rows.forEach(row => row.errors.forEach(error => sheet.addRow({ row: row.row, error })));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
