import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import * as ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildComponentJobsWorkbook,
  componentJobsFilename,
  downloadComponentJobsWorkbook,
  JOB_HEADERS,
  JOB_LIST_ROWS,
} from "../../client/src/pages/pms/componentJobsExport";
import { extractRawExcelData, normalizeColumnNames } from "../modules/bulk-upload/services/helpers";

const storageMocks = vi.hoisted(() => ({
  getJobs: vi.fn(),
  getComponentByCode: vi.fn(),
  getComponents: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getJobs: storageMocks.getJobs,
    getComponentByCode: storageMocks.getComponentByCode,
    getComponents: storageMocks.getComponents,
  },
}));

vi.mock("../modules/ranks/service", () => ({
  getAllRanks: vi.fn(),
}));

import { validateData } from "../modules/bulk-upload/services/validationService";
import { generateJobsTemplate } from "../modules/bulk-upload/services/templateService";
import { getAllRanks } from "../modules/ranks/service";

const REFERENCE_TEMPLATE = fileURLToPath(
  new URL("../../attached_assets/jobs_template_(37)_1790855295976.xlsx", import.meta.url),
);
const VESSEL_CODE = "VESSEL-01";

const components = [
  {
    id: "component-calendar",
    cuuid: "component-calendar",
    componentCode: "COMP-CAL",
    vesselId: VESSEL_CODE,
    name: "Calendar pump",
    fleetEquipmentCode: "FLEET-CAL",
    fleetEquipmentName: "Calendar fleet pump",
  },
  {
    id: "component-rh",
    cuuid: "component-rh",
    componentCode: "COMP-RH",
    vesselId: VESSEL_CODE,
    name: "Running-hours motor",
  },
  {
    id: "component-dual",
    cuuid: "component-dual",
    componentCode: "COMP-DUAL",
    vesselId: VESSEL_CODE,
    name: "Dual-frequency compressor",
  },
  {
    id: "same-code-other-vessel",
    componentCode: "COMP-LINKED",
    vesselId: "OTHER-VESSEL",
    name: "Wrong vessel component",
  },
  {
    id: "same-code-this-vessel",
    componentCode: "COMP-LINKED",
    vesselId: VESSEL_CODE,
    name: "Linked component on vessel",
  },
];

const vessels = [
  { id: VESSEL_CODE, vesselCode: VESSEL_CODE, name: "Test Vessel" },
  { id: "OTHER-VESSEL", vesselCode: "OTHER", name: "Other Vessel" },
];

const ranks = [
  { name: "Chief Engineer", label: "Chief Engineer" },
  { name: "Second Engineer", label: "Second Engineer" },
];

const jobFixtures = () => [
  {
    jobNo: "JOB-CAL",
    componentId: "component-calendar",
    componentCode: "",
    vesselId: VESSEL_CODE,
    jobTitle: "Calendar inspection",
    maintenanceBasis: "Calendar",
    frequencyValue: 6,
    frequencyUnit: "Months",
    intervalRunningHour: 0,
    taskType: "Inspection",
    assignedTo: "Second Engineer",
    approver: "Chief Engineer",
    jobPriority: "High",
    department: "Engine",
    classRelated: false,
    criticality: false,
    isActive: false,
    lastDoneDate: "2024-01-10",
    lastDoneRH: 0,
    briefWorkDescription: "",
  },
  {
    jobNo: "JOB-RH",
    componentId: null,
    componentCode: "COMP-RH",
    vesselId: VESSEL_CODE,
    jobTitle: "Running-hours overhaul",
    maintenanceBasis: "Running Hours",
    frequencyValue: 8_000,
    frequencyUnit: "Hours",
    intervalRunningHour: 7_500,
    taskType: "Overhaul",
    assignedTo: "Chief Engineer",
    approver: "Chief Engineer",
    jobPriority: "Medium",
    department: "Electrical",
    classRelated: true,
    criticality: true,
    isActive: true,
    lastDoneDate: "2024-03-15",
    lastDoneRH: 0,
  },
  {
    jobNo: "JOB-DUAL",
    componentId: null,
    componentCode: "",
    linkedComponentCodes: ["COMP-LINKED", "COMP-RH"],
    vesselId: VESSEL_CODE,
    jobTitle: "Dual-frequency service",
    maintenanceBasis: "Dual Frequency",
    frequencyValue: 12,
    frequencyUnit: "Months",
    intervalRunningHour: 3_200,
    taskType: "Service",
    assignedTo: "Second Engineer",
    approver: "Chief Engineer",
    jobPriority: "Low",
    department: "Deck",
    isActive: true,
    lastDoneDate: "2024-06-01",
    requiredSpareParts: [
      { partCode: "SP-2", quantityRequired: 2, quantity: 20, qty: 200 },
      { partCode: "SP-4", quantityRequired: 4, quantity: 40, qty: 400 },
    ],
    requiredTools: [
      { toolName: "Torque wrench", quantity: 2 },
      { toolName: "Strap wrench", quantity: 4 },
    ],
    safetyRequirements: {
      ppeRequirements: ["Face shield, goggles", "Safety gloves"],
      permitRequirements: ["Hot Work Permit", "Confined Space Permit"],
      otherRequirements: ["Isolate main supply", "Ventilate workspace"],
    },
  },
];

function worksheetHeaders(sheet: ExcelJS.Worksheet): string[] {
  return Array.from({ length: sheet.columnCount }, (_, index) => {
    const value = sheet.getCell(1, index + 1).value;
    return value == null ? "" : String(value);
  });
}

function worksheetRows(sheet: ExcelJS.Worksheet): string[][] {
  return Array.from({ length: sheet.rowCount }, (_, rowIndex) =>
    Array.from({ length: sheet.columnCount }, (_, columnIndex) => {
      const value = sheet.getCell(rowIndex + 1, columnIndex + 1).value;
      return value == null ? "" : String(value);
    }),
  );
}

function rowsFromGeneratedWorkbook(workbook: ExcelJS.Workbook) {
  return workbook.xlsx.writeBuffer().then(bytes => {
    const parsed = XLSX.read(bytes, { type: "array", cellDates: false });
    return normalizeColumnNames(extractRawExcelData(parsed.Sheets.Vessel_Job), "jobs");
  });
}

function extractInlineImportParsers() {
  const source = readFileSync(
    new URL("../modules/bulk-upload/services/importService.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("const parseStringList =");
  const end = source.indexOf("// MANY-TO-MANY:", start);
  if (start < 0 || end < 0) {
    throw new Error("Could not locate the inline job-import parser closures.");
  }
  const javascript = ts.transpile(source.slice(start, end), {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.None,
  });
  return new Function(
    "sparesByPartCode",
    `${javascript}\nreturn { parseStringList, parseSpareParts, parseTools };`,
  )(new Map());
}

beforeEach(() => {
  vi.clearAllMocks();
  storageMocks.getJobs.mockResolvedValue([]);
  storageMocks.getComponents.mockResolvedValue(components);
  storageMocks.getComponentByCode.mockImplementation(async (code: string, vesselCode: string) =>
    components.find(component =>
      component.componentCode === code && component.vesselId === vesselCode,
    ) ?? null,
  );
  vi.mocked(getAllRanks).mockResolvedValue([
    { name: "Chief Engineer", label: "Chief Engineer" },
    { name: "Second Engineer", label: "Second Engineer" },
  ] as any);
});

describe("Component Jobs export workbook", () => {
  it("matches the uploaded job template headers, Lists, and AB1 version marker", async () => {
    const reference = new ExcelJS.Workbook();
    await reference.xlsx.readFile(REFERENCE_TEMPLATE);
    const referenceJobs = reference.getWorksheet("Vessel_Job")!;
    const referenceHeaders = worksheetHeaders(referenceJobs);
    const referenceLists = worksheetRows(reference.getWorksheet("Lists")!);

    expect(JOB_HEADERS).toEqual(referenceHeaders.slice(0, JOB_HEADERS.length));
    expect(referenceHeaders[27]).toBe("_TEMPLATE_VERSION_2.0.0");
    expect(JOB_LIST_ROWS).toEqual(referenceLists);

    const result = buildComponentJobsWorkbook([], components, vessels, ranks);
    const exportedJobs = result.workbook.getWorksheet("Vessel_Job")!;
    expect(worksheetHeaders(exportedJobs)).toEqual(referenceHeaders);
    expect(exportedJobs.getCell("AB1").value).toBe("_TEMPLATE_VERSION_2.0.0");
    expect(worksheetRows(result.workbook.getWorksheet("Lists")!)).toEqual(referenceLists);
    for (let column = 1; column <= referenceJobs.columnCount; column++) {
      expect(exportedJobs.getColumn(column).width).toBe(referenceJobs.getColumn(column).width);
      expect(exportedJobs.getCell(1, column).style).toEqual(referenceJobs.getCell(1, column).style);
    }
  });

  it("exports one row per job, resolving the vessel component and retaining saved fields", async () => {
    const jobs = jobFixtures();
    const sourceSnapshots = [
      structuredClone(jobs),
      structuredClone(components),
      structuredClone(vessels),
    ];
    const { workbook, issues, rowCount } = buildComponentJobsWorkbook(jobs, components, vessels, ranks);
    const sheet = workbook.getWorksheet("Vessel_Job")!;
    const column = (header: string) => JOB_HEADERS.indexOf(header as typeof JOB_HEADERS[number]) + 1;
    const value = (row: number, header: string) => sheet.getCell(row, column(header)).value;

    expect(rowCount).toBe(jobs.length);
    expect(sheet.rowCount).toBe(jobs.length + 1);
    expect(value(2, "Component Code")).toBe("COMP-CAL");
    expect(value(2, "Component Name")).toBe("Calendar pump");
    expect(value(3, "Component Code")).toBe("COMP-RH");
    expect(value(3, "Component Name")).toBe("Running-hours motor");
    expect(value(4, "Component Code")).toBe("COMP-LINKED");
    expect(value(4, "Component Name")).toBe("Linked component on vessel");
    expect(value(4, "Interval Value")).toBe(12);
    expect(value(4, "Unit")).toBe("Months");
    expect(value(4, "Interval Running Hours")).toBe(3_200);

    // Frequency fields are independent; zero and false must not be lost to truthy fallbacks.
    expect(value(2, "Interval Value")).toBe(6);
    expect(value(2, "Unit")).toBe("Months");
    expect(value(2, "Interval Running Hours")).toBe(0);
    expect(value(3, "Interval Value")).toBe(8_000);
    expect(value(3, "Unit")).toBe("Hours");
    expect(value(3, "Interval Running Hours")).toBe(7_500);
    expect(value(2, "Last Done Hour")).toBe(0);
    expect(value(3, "Last Done Hour")).toBe(0);
    expect(value(2, "Is Active")).toBe("No");
    expect(value(2, "Criticality")).toBe("No");
    expect(value(2, "Class Related")).toBe("No");
    expect(value(2, "Last Done Date")).toBe("2024-01-10");
    expect(value(2, "Brief Work Description")).toBe("");

    expect(value(4, "Required Spare Parts")).toBe("SP-2:2; SP-4:4");
    expect(value(4, "Required Tools")).toBe("Torque wrench:2; Strap wrench:4;");
    expect(value(4, "PPE Requirements")).toBe("Face shield, goggles; Safety gloves;");
    expect(value(4, "Permit Requirements")).toBe("Hot Work Permit; Confined Space Permit;");
    expect(value(4, "Other Safety Requirements")).toBe("Isolate main supply; Ventilate workspace;");
    expect(issues.some(issue => /Torque wrench.*quantity.*not a separate quantity/i.test(issue))).toBe(true);
    expect(jobs).toEqual(sourceSnapshots[0]);
    expect(components).toEqual(sourceSnapshots[1]);
    expect(vessels).toEqual(sourceSnapshots[2]);
  });

  it("uses the same dropdown ranges as the existing jobs template on exported data rows", async () => {
    const templateBuffer = await generateJobsTemplate(VESSEL_CODE);
    const templateWorkbook = new ExcelJS.Workbook();
    await templateWorkbook.xlsx.load(templateBuffer);
    const templateSheet = templateWorkbook.getWorksheet("Vessel_Job")!;

    const exported = buildComponentJobsWorkbook(jobFixtures(), components, vessels, ranks).workbook;
    const exportSheet = exported.getWorksheet("Vessel_Job")!;
    const expected = [
      [7, "=Lists!$A$2:$A$4"],
      [9, "=Lists!$B$2:$B$6"],
      [11, "=Lists!$C$2:$C$9"],
      [14, "=Lists!$D$2:$D$5"],
      [15, "=Lists!$F$2:$F$3"],
      [19, "=Lists!$E$2:$E$9"],
      [20, "=Lists!$F$2:$F$3"],
      [21, "=Lists!$F$2:$F$3"],
    ] as const;

    for (const row of [2, 3, 4]) {
      for (const [column, formula] of expected) {
        expect(templateSheet.getCell(2, column).dataValidation?.formulae).toEqual([formula]);
        expect(exportSheet.getCell(row, column).dataValidation?.formulae).toEqual(
          templateSheet.getCell(2, column).dataValidation?.formulae,
        );
      }
    }
  });

  it("round-trips the exported sheet through raw extraction, column normalization, and validation", async () => {
    const { workbook } = buildComponentJobsWorkbook(jobFixtures(), components, vessels, ranks);
    const normalized = await rowsFromGeneratedWorkbook(workbook);
    expect(normalized).toHaveLength(3);
    expect(normalized.map(row => row["Maintenance Basis"])).toEqual([
      "Calendar",
      "Running Hours",
      "Dual Frequency",
    ]);
    expect(normalized[0]["Interval Running Hours"]).toBe(0);
    expect(normalized[1]["Last Done RH"]).toBe(0);
    expect(normalized[1]["Last Done Date"]).toBe("2024-03-15");
    expect(normalized[2]["Last Done Date"]).toBe("2024-06-01");

    const result = await validateData("jobs", normalized, "add", VESSEL_CODE);
    expect(result.summary.errors).toBe(0);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every(row => row.status === "ok" || row.status === "warning")).toBe(true);
    expect(storageMocks.getJobs).toHaveBeenCalled();
    expect(storageMocks.getComponentByCode).toHaveBeenCalled();
  });

  it("retains unsupported legacy list values with export issues and visible validator errors", async () => {
    const invalidJobs = [
      ...["Testing", "Repair", "Replacement", "Calibration"].map((taskType, index) => ({
        ...jobFixtures()[0],
        jobNo: `BAD-TASK-${index}`,
        jobTitle: `Unsupported ${taskType}`,
        taskType,
      })),
      {
        ...jobFixtures()[0],
        jobNo: "BAD-PRIORITY",
        jobTitle: "Unsupported Critical priority",
        jobPriority: "Critical",
      },
    ];
    const { workbook, issues } = buildComponentJobsWorkbook(invalidJobs, components, vessels, ranks);
    const normalized = await rowsFromGeneratedWorkbook(workbook);
    expect(normalized.map(row => row["Task Type"])).toEqual([
      "Testing", "Repair", "Replacement", "Calibration", "Inspection",
    ]);
    expect(normalized.map(row => row["Job Priority"])).toEqual([
      "High", "High", "High", "High", "Critical",
    ]);
    expect(issues.filter(issue => /not accepted by current job import validation/i.test(issue)))
      .toHaveLength(invalidJobs.length);

    const result = await validateData("jobs", normalized, "add", VESSEL_CODE);
    expect(result.rows).toHaveLength(invalidJobs.length);
    expect(result.summary.errors).toBe(invalidJobs.length);
    expect(result.rows.every(row => row.status === "error" && row.errors.length > 0)).toBe(true);
    expect(result.rows.flatMap(row => row.errors).join("\n")).toMatch(/Invalid Task Type/);
    expect(result.rows.flatMap(row => row.errors).join("\n")).toMatch(/Invalid Job Priority/);
  });

  it("parses generated spare, tool, and safety cell values through the exact inline importer closures", () => {
    const { parseStringList, parseSpareParts, parseTools } = extractInlineImportParsers();
    const workbook = buildComponentJobsWorkbook(jobFixtures(), components, vessels, ranks).workbook;
    const sheet = workbook.getWorksheet("Vessel_Job")!;
    const row = 4;
    const cell = (header: string) =>
      String(sheet.getCell(row, JOB_HEADERS.indexOf(header as typeof JOB_HEADERS[number]) + 1).value);

    const parsedSpares = parseSpareParts(cell("Required Spare Parts"));
    expect(parsedSpares.map((spare: any) => [spare.partCode, spare.quantityRequired])).toEqual([
      ["SP-2", "2"],
      ["SP-4", "4"],
    ]);
    expect(parseTools(cell("Required Tools"))).toEqual([
      { toolName: "Torque wrench:2", quantity: "", remarks: "" },
      { toolName: "Strap wrench:4", quantity: "", remarks: "" },
    ]);
    expect(parseStringList(cell("PPE Requirements"))).toEqual([
      "Face shield, goggles",
      "Safety gloves",
    ]);
    expect(parseStringList(cell("Permit Requirements"))).toEqual([
      "Hot Work Permit",
      "Confined Space Permit",
    ]);
    expect(parseStringList(cell("Other Safety Requirements"))).toEqual([
      "Isolate main supply",
      "Ventilate workspace",
    ]);
  });

  it("preserves and clearly flags zero, fallback, and missing spare quantities without inventing one", () => {
    const zeroAndMissingQuantities = {
      ...jobFixtures()[2],
      jobNo: "JOB-SPARE-QTY-EDGE",
      requiredSpareParts: [
        { partCode: "SP-ZERO", quantityRequired: 0, quantity: 2, qty: 3 },
        { partCode: "SP-QUANTITY", quantityRequired: null, quantity: 4, qty: 5 },
        { partCode: "SP-QTY", quantity: null, qty: 6 },
        { partCode: "SP-NONE", quantityRequired: null, quantity: null, qty: null },
      ],
    };
    const { workbook, issues } = buildComponentJobsWorkbook(
      [zeroAndMissingQuantities],
      components,
      vessels,
      ranks,
    );
    const value = workbook.getWorksheet("Vessel_Job")!.getCell(2, 23).value;
    expect(value).toBe("SP-ZERO:0; SP-QUANTITY:4; SP-QTY:6; SP-NONE:");
    expect(String(value)).not.toContain("SP-ZERO:1");
    expect(String(value)).not.toContain("SP-NONE:1");
    expect(issues.some(issue => /SP-ZERO.*not a positive integer/i.test(issue))).toBe(true);
    expect(issues.some(issue => /SP-NONE.*not a positive integer/i.test(issue))).toBe(true);
  });

  it("reports all missing mandatory export fields clearly", () => {
    const incomplete = {
      ...jobFixtures()[0],
      jobNo: "JOB-INCOMPLETE",
      jobTitle: "",
      componentId: null,
      componentCode: "",
      maintenanceBasis: "",
      frequencyValue: null,
      frequencyUnit: "",
      intervalRunningHour: null,
      taskType: "",
      approver: "",
    };
    const { issues } = buildComponentJobsWorkbook([incomplete], components, vessels, ranks);
    const message = issues.join("\n");
    expect(message).toMatch(/WO Title is required by the importer/);
    expect(message).toMatch(/Component Code is required by the importer/);
    expect(message).toMatch(/Maintenance Basis is required by the importer/);
    expect(message).toMatch(/Interval Value is required by the importer/);
    expect(message).toMatch(/Task Type is required by the importer/);
    expect(message).toMatch(/Approver is required by the importer/);
  });

  it("warns about invalid saved approver/assignee ranks and unrecognized dates", () => {
    const invalidReferences = {
      ...jobFixtures()[0],
      approver: "Unlisted Rank",
      assignedTo: "Unlisted Assignee",
      lastDoneDate: "not a recognizable date",
    };
    const { issues } = buildComponentJobsWorkbook(
      [invalidReferences],
      components,
      vessels,
      ranks,
    );
    expect(issues.join("\n")).toMatch(/Approver.*not in the current Rank Master/i);
    expect(issues.join("\n")).toMatch(/Assigned To.*not accepted/i);
    expect(issues.join("\n")).toMatch(/Last Done Date is not recognized/i);
  });

  it("builds a local-time DD-MM-YYYY filename and sanitizes filesystem-unsafe characters", () => {
    const localDate = new Date(2025, 0, 9, 12, 0, 0);
    const filename = componentJobsFilename('MV "North"/Star: <A>|?', localDate);

    expect(filename).toContain("09-01-2025");
    expect(filename).toMatch(/\.xlsx$/);
    expect(filename).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/);
    expect(componentJobsFilename("MV Ocean", localDate)).toBe("MV Ocean_Jobs_09-01-2025.xlsx");
  });

  it("downloads a valid OOXML workbook with the expected MIME type and propagates click failures", async () => {
    const workbook = buildComponentJobsWorkbook([], components, vessels, ranks).workbook;
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const body = { appendChild: vi.fn() };
    let downloadBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      downloadBlob = blob;
      return "blob:component-jobs";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body,
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("setTimeout", (callback: () => void) => {
      callback();
      return 1;
    });

    try {
      await downloadComponentJobsWorkbook(workbook, "jobs.xlsx");
      expect(anchor.download).toBe("jobs.xlsx");
      expect(anchor.href).toBe("blob:component-jobs");
      expect(body.appendChild).toHaveBeenCalledWith(anchor);
      expect(anchor.click).toHaveBeenCalledOnce();
      expect(anchor.remove).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:component-jobs");
      expect(downloadBlob?.type).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      const downloadedWorkbook = new ExcelJS.Workbook();
      await downloadedWorkbook.xlsx.load(await downloadBlob!.arrayBuffer());
      expect(downloadedWorkbook.getWorksheet("Vessel_Job")?.getCell("AB1").value)
        .toBe("_TEMPLATE_VERSION_2.0.0");

      const clickFailure = new Error("download click failed");
      anchor.click.mockImplementationOnce(() => { throw clickFailure; });
      await expect(downloadComponentJobsWorkbook(workbook, "jobs.xlsx")).rejects.toBe(clickFailure);
      expect(anchor.remove).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});