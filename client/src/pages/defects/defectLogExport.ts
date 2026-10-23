import * as XLSX from "xlsx";
import type { Defect } from "@shared/schema";
import { getComputedStatus } from "@/lib/defectStatusUtils";

export const DEFECT_LOG_EXPORT_COLUMNS = [
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

type DefectLogExportRow = Record<(typeof DEFECT_LOG_EXPORT_COLUMNS)[number], string>;
type GridFilterModel = Record<string, any>;

function getDateParts(value: unknown): { year: number; month: number; day: number } | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }

  if (value == null || value === "") return null;
  const text = String(value).trim();

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const dayFirstMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dayFirstMatch) {
    return {
      year: Number(dayFirstMatch[3]),
      month: Number(dayFirstMatch[2]),
      day: Number(dayFirstMatch[1]),
    };
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

function dateKey(value: unknown): string | null {
  const parts = getDateParts(value);
  if (!parts) return null;
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Formats defect dates using the same calendar date shown by the Defect Log. */
export function formatDefectDate(value: unknown): string {
  const parts = getDateParts(value);
  if (!parts) return value == null ? "" : String(value);

  const day = String(parts.day).padStart(2, "0");
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(parts.year, parts.month - 1, 1)));
  return `${day} ${month} ${parts.year}`;
}

export function stripDefectHtml(value: string | null | undefined): string {
  if (!value) return "";
  if (typeof document === "undefined") {
    return value.replace(/<[^>]*>/g, "");
  }
  const element = document.createElement("div");
  element.innerHTML = value;
  return element.textContent || element.innerText || "";
}

export function makeDefectLogExportRow(defect: Defect): DefectLogExportRow {
  return {
    "ID": defect.id || "",
    "Vessel": defect.vesselName || "",
    "Issue Date": formatDefectDate(defect.issueDate),
    "Category": `${defect.category || "Defect"}${defect.is_coc === true ? " (CoC)" : ""}`,
    "Component": defect.componentHardwareLevel3 || "-",
    "Description": stripDefectHtml(defect.description),
    "Target Date": formatDefectDate(defect.targetCloseDate),
    "Date Compl.": formatDefectDate(defect.dateCompleted),
    "Status": getComputedStatus(defect).label,
    "Priority": defect.priority || "-",
  };
}

function matchesTextCondition(value: unknown, model: any): boolean {
  const text = value == null ? "" : String(value).toLocaleLowerCase();
  const filter = String(model.filter ?? "").toLocaleLowerCase();
  switch (model.type) {
    case "contains": return text.includes(filter);
    case "notContains": return !text.includes(filter);
    case "equals": return text === filter;
    case "notEqual": return text !== filter;
    case "startsWith": return text.startsWith(filter);
    case "endsWith": return text.endsWith(filter);
    case "blank": return text.length === 0;
    case "notBlank": return text.length > 0;
    default: return true;
  }
}

function matchesDateCondition(value: unknown, model: any): boolean {
  const actual = dateKey(value);
  if (model.type === "blank") return actual === null;
  if (model.type === "notBlank") return actual !== null;
  if (!actual || !model.dateFrom) return false;

  const from = dateKey(model.dateFrom);
  const to = model.dateTo ? dateKey(model.dateTo) : null;
  if (!from) return false;
  switch (model.type) {
    case "equals": return actual === from;
    case "notEqual": return actual !== from;
    case "lessThan": return actual < from;
    case "greaterThan": return actual > from;
    case "inRange": return actual >= from && !!to && actual <= to;
    default: return true;
  }
}

function matchesFilterCondition(value: unknown, model: any): boolean {
  if (!model) return true;
  if (Array.isArray(model.conditions) && model.conditions.length > 0) {
    const outcomes = model.conditions.map((condition: any) => matchesFilterCondition(value, condition));
    return model.operator === "OR" ? outcomes.some(Boolean) : outcomes.every(Boolean);
  }

  if (model.filterType === "set") {
    const selectedValues = model.values as unknown[] | undefined;
    if (!selectedValues) return true;
    const isBlank = value == null || value === "";
    return selectedValues.some((selected) =>
      (selected == null || selected === "(Blanks)") ? isBlank : String(selected) === String(value)
    );
  }
  if (model.filterType === "date") return matchesDateCondition(value, model);
  if (model.filterType === "text") return matchesTextCondition(value, model);
  return true;
}

/** Applies AG Grid's active column filters to the full, externally-filtered result set. */
export function filterDefectsForExport<T extends object>(
  defects: T[],
  filterModel: GridFilterModel | null | undefined,
): T[] {
  const activeFilters = Object.entries(filterModel || {});
  if (activeFilters.length === 0) return defects;
  return defects.filter((defect) => {
    const row = defect as Record<string, any>;
    return activeFilters.every(([field, model]) => matchesFilterCondition(row[field], model));
  });
}

export function downloadDefectLogCsv(defects: Defect[], filename = "defects_log.csv"): void {
  const workbook = buildDefectLogWorkbook(defects);
  XLSX.writeFile(workbook, filename, { bookType: "csv" });
}

export function downloadDefectLogExcel(defects: Defect[], filename = "defects_log.xlsx"): void {
  const workbook = buildDefectLogWorkbook(defects);
  XLSX.writeFile(workbook, filename, { bookType: "xlsx" });
}

export function buildDefectLogWorkbook(defects: Defect[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const worksheet = buildDefectLogWorksheet(defects);
  worksheet["!cols"] = DEFECT_LOG_EXPORT_COLUMNS.map((header) => ({
    wch: header === "Description" ? 48 : header === "Component" ? 32 : 20,
  }));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Defects Log");
  return workbook;
}

export function buildDefectLogWorksheet(defects: Defect[]): XLSX.WorkSheet {
  const rows = defects.map(makeDefectLogExportRow);
  const data = [
    [...DEFECT_LOG_EXPORT_COLUMNS],
    ...rows.map((row) => DEFECT_LOG_EXPORT_COLUMNS.map((header) => row[header])),
  ];
  return XLSX.utils.aoa_to_sheet(data);
}
