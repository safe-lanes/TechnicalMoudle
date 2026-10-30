import { describe, it, expect } from "vitest";
import XLSX from "xlsx";
import { execFileSync } from "node:child_process";
import { readSectionHWorkbook, headers } from "../services/classRegulatoryWorkbook";

function dates(serial: number, date1904 = false, type: "xlsx" | "biff8" = "xlsx") {
  const book = XLSX.utils.book_new();
  book.Workbook = { WBProps: { date1904 } };
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    headers(), ["001.010", "DNV", "CERT", serial, "", "ANN", "", "DNV", "", "TEST"],
  ]), "Import");
  return XLSX.write(book, { type: "buffer", bookType: type }) as Buffer;
}

describe("regulatory workbook date parsing", () => {
  it.each(["xlsx", "biff8"] as const)("reads real numeric dates from %s in both Excel epochs", type => {
    for (const [serial, epoch, day] of [[46296, false, "01-10-2026"], [1, true, "02-01-1904"]] as const) {
      const row = readSectionHWorkbook(dates(serial, epoch, type), type === "biff8" ? "dates.xls" : "dates.xlsx").rows[0];
      expect(row.values.lastClassSurveyDate).toBe(day);
      expect(row.errors).toEqual([]);
    }
  });
  it.each([60, -1, 2958466])("rejects invalid calendar serial %s without crashing the workbook", serial => {
    const row = readSectionHWorkbook(dates(serial), "dates.xlsx").rows[0];
    expect(row.errors.join()).toContain("Last Class Survey Date:");
  });
  it("parses dates under native Node/tsx CommonJS interop, not just Vitest transforms", () => {
    const output = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import XLSX from "xlsx";
      import { readSectionHWorkbook, headers } from "./server/modules/bulk-upload/services/classRegulatoryWorkbook.ts";
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
        headers(), ["001", "DNV", "CERT", 46296, "", "ANN", "", "", "", "TEST"]
      ]), "Import");
      const row = readSectionHWorkbook(XLSX.write(book, {type:"buffer",bookType:"xlsx"}), "dates.xlsx").rows[0];
      console.log(JSON.stringify({date:row.values.lastClassSurveyDate, errors:row.errors}));
    `], { cwd: process.cwd(), encoding: "utf8", timeout: 20_000 });
    expect(JSON.parse(output.trim())).toEqual({ date: "01-10-2026", errors: [] });
  });
});
