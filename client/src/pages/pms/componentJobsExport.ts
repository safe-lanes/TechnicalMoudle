import ExcelJS from "exceljs";
import { normalizeDateToDDMMMYYYY } from "@shared/dateUtils";

// Exclusive to the Work Orders dialog's Component Jobs export. These values
// intentionally match the uploaded template, including its legacy Lists values.
export const JOB_HEADERS = [
  "Job Code", "Fleet Equipment Code", "Fleet Equipment Name", "WO Title",
  "Component Code", "Component Name", "Maintenance Basis", "Interval Value",
  "Unit", "Interval Running Hours", "Task Type", "Assigned To", "Approver",
  "Job Priority", "Class Related", "Last Done Date", "Last Done Hour",
  "Brief Work Description", "Department", "Criticality", "Is Active", "Vessel Code",
  "Required Spare Parts", "Required Tools", "PPE Requirements",
  "Permit Requirements", "Other Safety Requirements",
] as const;

const JOB_WIDTHS = [
  18, 22, 30, 35, 20, 30, 18, 15, 12, 22, 20, 20, 20, 15, 15, 15, 18, 50,
  20, 15, 12, 15, 40, 40, 35, 35, 35,
];
export const JOB_LIST_ROWS = [
  ["Maintenance_Basis", "Interval_Unit", "Task_Type", "Job_Priority", "Department", "Yes_No"],
  ["Calendar", "Days", "Inspection", "Low", "Engine", "Yes"],
  ["Running Hours", "Weeks", "Overhaul", "Medium", "Deck", "No"],
  ["Dual Frequency", "Months", "Service", "High", "Electrical", ""],
  ["", "Years", "Testing", "Critical", "C/E", ""],
  ["", "Hours", "Repair", "", "2/E", ""],
  ["", "", "Replacement", "", "3/E", ""],
  ["", "", "Cleaning", "", "4/E", ""],
  ["", "", "Calibration", "", "ETO", ""],
];
const VALID_TASKS = [
  "Inspection", "Overhaul", "Service", "Test", "Renew/Replace",
  "Measurement/Calibration", "Megger Test", "Cleaning", "Lubrication",
  "Survey", "Analysis", "Checks",
];
const VALID_ASSIGNEES = [
  "Master", "Chief Officer", "2nd Officer", "Second Officer", "3rd Officer", "Third Officer",
  "Chief Engineer", "2nd Engineer", "Second Engineer", "3rd Engineer", "Third Engineer",
  "4th Engineer", "Fourth Engineer", "5th Engineer", "Electrical Officer", "Electrical Engineer",
  "Electrician", "Gas Engineer", "Deck Cadet", "Engine Cadet", "Bosun", "AB", "OS", "Pumpman",
  "Fitter", "Motorman", "Oiler", "Wiper", "Chief Cook", "Messman", "Junior Officer",
];
const blank = (value: unknown) => value == null || String(value).trim() === "";
const saved = (...values: any[]) => values.find(value => !blank(value)) ?? "";
const yesNo = (value: any) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return value ?? "";
};

export function componentJobsFilename(vesselName: string, now = new Date()): string {
  // Date getters use the user's browser timezone, rather than the server's UTC.
  const date = [now.getDate(), now.getMonth() + 1, now.getFullYear()]
    .map((value, index) => index < 2 ? String(value).padStart(2, "0") : String(value))
    .join("-");
  return `${vesselName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")}_Jobs_${date}.xlsx`;
}

type RecordData = Record<string, any>;

export function buildComponentJobsWorkbook(
  jobs: RecordData[],
  components: RecordData[],
  vessels: RecordData[],
  ranks?: RecordData[],
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Vessel_Job");
  sheet.columns = JOB_HEADERS.map((header, index) => ({ header, width: JOB_WIDTHS[index] }));
  sheet.getCell("AB1").value = "_TEMPLATE_VERSION_2.0.0";
  const lists = workbook.addWorksheet("Lists");
  lists.columns = [18, 15, 20, 12, 20, 10].map(width => ({ width }));
  JOB_LIST_ROWS.forEach(row => lists.addRow([...row]));

  // Component codes are only unique within a vessel. Never resolve another
  // vessel's similarly coded component during All/My Vessels exports.
  const byId = new Map<string, RecordData>();
  const byCode = new Map<string, RecordData>();
  components.forEach(component => {
    [component.id, component.cuuid].filter(Boolean).forEach(id => byId.set(String(id), component));
    if (component.componentCode) {
      byCode.set(`${component.vesselId}|${component.componentCode}`, component);
    }
  });
  const issues: string[] = [];
  const compositeKeys = new Set<string>();

  jobs.forEach((job, index) => {
    const rowNumber = index + 2;
    const warn = (message: string) => issues.push(`Row ${rowNumber} (${job.jobNo || "no job code"}): ${message}`);
    const componentFromId = byId.get(String(job.componentId));
    const linkedCodes: string[] = Array.isArray(job.linkedComponentCodes) ? job.linkedComponentCodes : [];
    const component = (componentFromId?.vesselId === job.vesselId ? componentFromId : undefined)
      ?? byCode.get(`${job.vesselId}|${job.componentCode}`)
      ?? linkedCodes.map(code => byCode.get(`${job.vesselId}|${code}`)).find(Boolean);
    const componentCode = saved(job.componentCode, component?.componentCode, linkedCodes[0]);
    if (!component) warn("Linked component could not be resolved; missing identity fields are left blank.");
    if (component && component.componentCode !== componentCode) warn("Saved Component Code differs from the linked component; review this association before import.");
    if (new Set([job.componentCode, ...linkedCodes].filter(Boolean)).size > 1) {
      warn("This job has multiple component links. One row per job is exported; the template can represent only one component per row.");
    }

    const serializeList = (value: any, field: string): string => {
      if (blank(value)) return "";
      if (typeof value === "string") return value;
      if (!Array.isArray(value)) {
        warn(`${field} has an unsupported saved structure; review before import.`);
        return JSON.stringify(value);
      }
      const entries = value.map(entry => {
        const text = typeof entry === "string" ? entry : JSON.stringify(entry);
        if (typeof entry !== "string" || text.includes(";") || text.trim() !== text || !text) {
          warn(`${field} contains an entry the importer may split or normalize; review before import.`);
        }
        return text;
      });
      // A trailing delimiter also preserves commas inside a SINGLE list item:
      // the importer chooses ';' only when at least one is present.
      return entries.length ? `${entries.join("; ")};` : "";
    };

    const serializeSpares = (value: any): string => {
      if (!Array.isArray(value)) return serializeList(value, "Required Spare Parts");
      return value.map(spare => {
        if (typeof spare === "string") return spare;
        const code = saved(spare.partCode, spare.spareCode, spare.code, spare.partNo);
        const quantity = spare.quantityRequired ?? spare.quantity ?? spare.qty ?? "";
        if (blank(code)) {
          warn("A required spare has no Part Code; its saved details cannot be linked reliably on import.");
          return `${saved(spare.description, spare.partName, JSON.stringify(spare))}:${quantity}`;
        }
        if (/[;,:]/.test(String(code))) warn("A spare code contains an import delimiter.");
        if (blank(quantity) || !/^\d+$/.test(String(quantity)) || Number(quantity) <= 0) {
          warn(`Spare ${code} quantity '${quantity}' is not a positive integer; the importer would default or truncate it. The saved quantity is exported unchanged.`);
        }
        return `${code}:${quantity}`;
      }).join("; ");
    };

    const serializeTools = (value: any): string => {
      if (!Array.isArray(value)) return serializeList(value, "Required Tools");
      const entries = value.map(tool => {
        if (typeof tool === "string") return tool;
        const name = saved(tool.toolName, tool.name);
        const quantity = tool.quantity ?? tool.quantityRequired ?? tool.qty;
        if (blank(name)) warn("A required tool has no saved name.");
        if (!blank(quantity)) {
          warn(`Tool '${name}' quantity is preserved as Name:Quantity text. The current importer stores this text as the tool name, not a separate quantity.`);
          return `${name}:${quantity}`;
        }
        return name || JSON.stringify(tool);
      });
      return serializeList(entries, "Required Tools");
    };

    const safety = job.safetyRequirements ?? {};
    const vessel = vessels.find(v => String(v.id ?? v.vuuid) === String(job.vesselId));
    const values: any[] = [
      job.jobNo ?? "",
      saved(job.fleetEquipmentCode, component?.fleetEquipmentCode),
      saved(job.fleetEquipmentName, component?.fleetEquipmentName),
      job.jobTitle ?? "",
      componentCode,
      saved(job.componentName, component?.name),
      saved(job.maintenanceBasis, job.frequencyType),
      job.frequencyValue ?? "",
      job.frequencyUnit ?? "",
      job.intervalRunningHour ?? "",
      saved(job.taskType, job.maintenanceType),
      job.assignedTo ?? "",
      job.approver ?? "",
      job.jobPriority ?? "",
      yesNo(job.classRelated),
      job.lastDoneDate ?? "",
      job.lastDoneRH ?? "",
      job.briefWorkDescription ?? job.jobDescription ?? "",
      job.department ?? "",
      yesNo(job.criticality),
      yesNo(job.isActive),
      saved(job.vesselCode, vessel?.vesselCode, vessel?.code, job.vesselId),
      serializeSpares(job.requiredSpareParts),
      serializeTools(job.requiredTools),
      serializeList(safety.ppeRequirements ?? job.ppeRequirements, "PPE Requirements"),
      serializeList(safety.permitRequirements ?? job.permitRequirements, "Permit Requirements"),
      serializeList(safety.otherRequirements ?? job.otherSafetyRequirements, "Other Safety Requirements"),
    ];
    const row = Object.fromEntries(JOB_HEADERS.map((header, i) => [header, values[i]]));
    const required = ["WO Title", "Vessel Code", "Component Code", "Maintenance Basis", "Interval Value", "Task Type", "Approver"];
    required.forEach(field => { if (blank(row[field])) warn(`${field} is required by the importer but is missing.`); });
    if (ranks && !blank(row.Approver) && !ranks.some(rank =>
      [rank.name, rank.label].some(name => !blank(name) && String(name).trim().toLowerCase() === String(row.Approver).trim().toLowerCase()),
    )) warn(`Approver '${row.Approver}' is not in the current Rank Master.`);
    const checkLookup = (field: string, allowed: string[]) => {
      if (!blank(row[field]) && !allowed.includes(String(row[field]))) {
        warn(`${field} '${row[field]}' is not accepted by current job import validation. Saved value retained.`);
      }
    };
    checkLookup("Maintenance Basis", ["Calendar", "Running Hours", "Dual Frequency"]);
    checkLookup("Task Type", VALID_TASKS);
    checkLookup("Job Priority", ["Low", "Medium", "High"]);
    checkLookup("Department", ["Engine", "Deck", "Electrical", "C/E", "2/E", "3/E", "4/E", "ETO"]);
    if (!blank(row["Assigned To"]) && !VALID_ASSIGNEES.some(rank => rank.toLowerCase() === String(row["Assigned To"]).trim().toLowerCase())) {
      warn(`Assigned To '${row["Assigned To"]}' is not accepted by current job import validation.`);
    }
    if (!blank(row["Interval Value"]) && !(Number(row["Interval Value"]) > 0)) warn("Interval Value must be a positive number for import.");
    if (["Calendar", "Dual Frequency"].includes(row["Maintenance Basis"])) {
      if (blank(row.Unit)) warn("Unit is required for Calendar/Dual Frequency import.");
      checkLookup("Unit", ["Hours", "Days", "Weeks", "Months", "Years"]);
      if (row.Unit === "Hours") warn("Calendar Hours are accepted by validation but not supported by the current importer's next-due date calculation.");
    }
    if (row["Maintenance Basis"] === "Dual Frequency" && !(Number(row["Interval Running Hours"]) > 0)) {
      warn("Dual Frequency requires positive Interval Running Hours for import.");
    }
    if (row["Maintenance Basis"] === "Running Hours" && row.Unit !== "Hours") {
      warn("The importer will set the Running Hours Unit to Hours; the saved Unit is exported unchanged.");
    }
    ["Class Related", "Criticality", "Is Active"].forEach(field => {
      if (!blank(row[field]) && !/^(yes|no|y|n|true|false|1|0)$/i.test(String(row[field]).trim())) warn(`${field} is not accepted as a Yes/No value.`);
    });
    if (blank(row["Is Active"])) warn("Is Active is blank; the importer defaults it to Yes.");
    if (!blank(row["Last Done Hour"]) && !Number.isFinite(Number(row["Last Done Hour"]))) warn("Last Done Hour is not numeric.");
    if (!blank(row["Last Done Date"]) && !normalizeDateToDDMMMYYYY(row["Last Done Date"])) {
      warn("Last Done Date is not recognized by the importer; it would fall back to the component installation date. Saved value retained.");
    }
    if (blank(row["Last Done Date"])) warn("Last Done Date is blank; the importer may use the component installation date.");
    if (!blank(row["Interval Value"]) && !Number.isInteger(Number(row["Interval Value"])) && row["Maintenance Basis"] !== "Running Hours") {
      warn("The importer truncates fractional calendar intervals when calculating the next due date.");
    }
    const key = `${row["Job Code"]}|${componentCode}|${row["Vessel Code"]}`.toUpperCase();
    if (compositeKeys.has(key)) warn("Duplicate Job Code / Component Code / Vessel Code in this export.");
    compositeKeys.add(key);

    const excelRow = sheet.addRow(values);
    // Template headers and Lists are unstyled; preserve their default formatting.
    // Apply its dropdowns to the actual exported rows (reference has no data rows).
    const validations: [number, string][] = [
      [7, "=Lists!$A$2:$A$4"], [9, "=Lists!$B$2:$B$6"],
      [11, "=Lists!$C$2:$C$9"], [14, "=Lists!$D$2:$D$5"],
      [15, "=Lists!$F$2:$F$3"], [19, "=Lists!$E$2:$E$9"],
      [20, "=Lists!$F$2:$F$3"], [21, "=Lists!$F$2:$F$3"],
    ];
    validations.forEach(([column, formula]) => {
      excelRow.getCell(column).dataValidation = { type: "list", allowBlank: true, formulae: [formula] };
    });
  });
  return { workbook, issues, rowCount: jobs.length };
}

export async function downloadComponentJobsWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    // Give the browser time to start its download before releasing the buffer.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}