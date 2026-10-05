import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { SPARES_TEMPLATE_FIELDS } from "@shared/sparesTemplateFields";
import {
  uniqueSparesFilename, uniqueSparesVesselIds, fetchUniqueSparesData,
  buildUniqueSparesWorkbook, downloadUniqueSparesWorkbook,
} from "./uniqueSparesExport";

const component = (vesselId = "v1", suffix = "a") => ({
  id: `legacy-${vesselId}-${suffix}`, cuuid: `${vesselId}-${suffix}`, vesselId,
  componentCode: "601.001", name: `Engine ${suffix}`, fleetEquipmentCode: `fleet-${suffix}`,
  fleetEquipmentName: `Fleet engine ${suffix}`, category: "Machinery", isActive: true,
});
const spare = (id = 1, vesselId = "v1"): Record<string, any> => ({
  id, suuid: `${vesselId}-spare-${id}`, vesselId, partCode: `PT-${id}`,
  partName: `Spare ${id}`, componentId: `${vesselId}-a`, componentCode: "601.001",
  componentName: "", rob: 0, robLocationA: 0, robLocationB: 0, min: 0,
  isActive: true, isRotationItem: true, critical: "Non-Critical", ihm: "No", uom: "PCS",
});
function reader(
  spares: Record<string, any>[], components: Record<string, any>[] = [component()], pageSize = 200,
) {
  const calls: string[] = [];
  return {
    calls,
    read: async (url: string) => {
      calls.push(url);
      const parsed = new URL(url, "http://test");
      const vesselId = decodeURIComponent(parsed.pathname.split("/").pop()!);
      if (url.includes("/components/")) return components.filter(c => c.vesselId === vesselId);
      assert.ok(url.includes("/spares-with-inventory/"), "Unique Spares must not depend on link endpoints");
      const eligible = spares.filter(s => s.vesselId === vesselId &&
        (!parsed.searchParams.has("activeOnly") || s.isActive !== false));
      const page = Number(parsed.searchParams.get("page"));
      return {
        success: true,
        data: {
          items: eligible.slice((page - 1) * pageSize, page * pageSize)
            .map(s => ({ spare: s, linkedComponents: [{ componentId: "secondary-1" }, { componentId: "secondary-2" }] })),
          total: eligible.length,
        },
      };
    },
  };
}

test("fetches every page independently of grid filters and includes unlinked spares", async () => {
  const records = Array.from({ length: 1001 }, (_, i) => spare(i + 1));
  records[1000] = { ...records[1000], componentId: null, componentCode: null, componentName: "" };
  const api = reader(records);
  const data = await fetchUniqueSparesData(["v1"], false, api.read);
  assert.equal(data.rows.length, 1001);
  assert.equal(data.rows[1000].spare.partCode, "PT-1001");
  assert.equal(data.rows[1000].component.componentCode, "");
  assert.equal(api.calls.filter(c => c.includes("/spares-with-inventory/")).length, 6);
  for (const url of api.calls) {
    assert.ok(!/[?&](search|componentId|stockStatus|criticality|rotation)=/.test(url));
    if (url.includes("/spares-with-inventory/")) assert.equal(new URL(url, "http://test").searchParams.get("pageSize"), "200");
  }
});

test("scope selection preserves single, All and assigned My Vessels without widening an empty assignment", async () => {
  assert.deepEqual(uniqueSparesVesselIds("v1", false, [], ["v2"]), ["v1"]);
  assert.deepEqual(uniqueSparesVesselIds("all", false, [], ["v1", "v2"]), ["v1", "v2"]);
  assert.deepEqual(uniqueSparesVesselIds("my", true, ["v2", "v2"], ["v1", "v2"]), ["v2"]);
  assert.deepEqual(uniqueSparesVesselIds("my", true, [], ["v1"]), []);
  const api = reader([spare(), spare(1, "v2")], [component(), component("v2")]);
  const my = await fetchUniqueSparesData(uniqueSparesVesselIds("my", true, ["v2"], ["v1", "v2"]), false, api.read);
  assert.equal(my.rows.length, 1);
  assert.equal(my.rows[0].spare.vesselId, "v2");
  assert.ok(api.calls.every(url => !url.includes("/v1") && !/\/(all|my)(\?|$)/.test(url)));
  assert.equal((await fetchUniqueSparesData([], false, api.read)).rows.length, 0);
  await assert.rejects(fetchUniqueSparesData(["all"], false, api.read), /concrete vessel/);
});

test("deduplicates by part code within each vessel, not by links or globally across vessels", async () => {
  const api = reader([spare(), { ...spare(2), partCode: "PT-1" }, spare(3), spare(1, "v2")],
    [component(), component("v2")], 1);
  const data = await fetchUniqueSparesData(["v1", "v2", "v1"], false, api.read);
  assert.deepEqual(data.rows.map(r => `${r.spare.vesselId}:${r.spare.partCode}`),
    ["v1:PT-1", "v1:PT-3", "v2:PT-1"]);
  assert.equal(data.rows[0].spare.id, 1);
  assert.equal(data.rows[0].component.name, "Engine a", "must not choose a secondary component");
});

test("preserves inactive office-visible spares and excludes deleted/fleet or role-hidden records", async () => {
  const records = [
    spare(), { ...spare(2), isActive: false }, { ...spare(3), deleted: true },
    { ...spare(4), isDeleted: true }, { ...spare(5), dataScope: "fleet" },
  ];
  const api = reader(records, [component(), { ...component("v1", "b"), isActive: false }]);
  const office = await fetchUniqueSparesData(["v1"], false, api.read);
  assert.deepEqual(office.rows.map(r => r.spare.id), [1, 2]);
  const active = await fetchUniqueSparesData(["v1"], true, api.read);
  assert.deepEqual(active.rows.map(r => r.spare.id), [1]);
  assert.equal(active.components.length, 1);
  assert.ok(api.calls.some(url => url.includes("activeOnly=true")));
  // Defensive filtering still applies if the API mistakenly returns hidden records.
  const hidden = await fetchUniqueSparesData(["v1"], true, async url =>
    url.includes("/components/") ? [] : { data: { items: records.map(s => ({ spare: s })), total: 5 } });
  assert.deepEqual(hidden.rows.map(r => r.spare.id), [1]);
});

test("fails clearly for other-vessel, malformed, failed, changing and incomplete inventory responses", async () => {
  const invalidPayloads = [
    { success: false, data: { items: [], total: 0 } },
    { data: { items: [], total: "1" } },
    { data: { items: [], total: -1 } },
    { data: { items: [{ spare: spare(1, "v2") }], total: 1 } },
    { data: { items: [{ spare: { ...spare(), id: null } }], total: 1 } },
    { data: { items: [{ spare: { ...spare(), partCode: "" } }], total: 1 } },
    { data: { items: [], total: 1 } },
    { data: { items: [{ spare: spare() }], total: 0 } },
  ];
  for (const payload of invalidPayloads) {
    await assert.rejects(fetchUniqueSparesData(["v1"], false, async url =>
      url.includes("/components/") ? [] : payload));
  }
  await assert.rejects(fetchUniqueSparesData(["v1"], false, async () => { throw new Error("Network failure"); }), /Network failure/);
  await assert.rejects(fetchUniqueSparesData(["v1"], false, async () => ({})), /component response/);
  for (const changing of [
    { data: { items: [{ spare: spare(2) }], total: 3 } },
    { data: { items: [], total: 2 } },
    { data: { items: [{ spare: spare() }], total: 2 } },
    { data: { items: [{ spare: { ...spare(2), suuid: spare().suuid } }], total: 2 } },
  ]) {
    await assert.rejects(fetchUniqueSparesData(["v1"], false, async url => {
      if (url.includes("/components/")) return [];
      return url.includes("page=1&") ? { data: { items: [{ spare: spare() }], total: 2 } } : changing;
    }), /changed|Incomplete/);
  }
});

test("scope changes before or during a fetch prevent completion", async () => {
  const api = reader([spare(), spare(2)], [component()], 1);
  await assert.rejects(fetchUniqueSparesData(["v1"], false, api.read,
    () => { throw new Error("Scope changed"); }), /Scope changed/);
  assert.equal(api.calls.length, 0);
  let current = true;
  await assert.rejects(fetchUniqueSparesData(["v1"], false, async url => {
    const result = await api.read(url);
    if (url.includes("/spares-with-inventory/")) current = false;
    return result;
  }, () => { if (!current) throw new Error("Scope changed"); }), /Scope changed/);
});

test("preserves saved master fields and zero values while normalizing template Yes/No values", async () => {
  const saved = {
    ...spare(), componentName: "Saved component name", fleetEquipmentCode: "saved-fleet",
    fleetEquipmentName: "Saved fleet name", pageNumber: 0, isActive: false, ihm: "true",
    drawingNumber: null, drawingNo: "D-42", isRotationItem: false,
  };
  const api = reader([saved]);
  const data = await fetchUniqueSparesData(["v1"], false, api.read);
  const sheet = buildUniqueSparesWorkbook(data).getWorksheet("Spares")!;
  const values = Object.fromEntries(SPARES_TEMPLATE_FIELDS.map((f, i) => [f.header, sheet.getCell(2, i + 1).value]));
  assert.equal(values["Component Name"], "Saved component name");
  assert.equal(values["Fleet Equipment Code"], "saved-fleet");
  assert.equal(values["Fleet Equipment Name"], "Saved fleet name");
  for (const key of ["Total ROB", "Location A - ROB", "Location B - ROB", "Minimum Stock", "Page Number"]) {
    assert.equal(values[key], 0);
  }
  assert.equal(values["Reserved"], "");
  assert.equal(values["Note"], "");
  assert.equal(values["Drawing Number"], "D-42");
  assert.equal(values["Criticality"], "No");
  assert.equal(values["Is Active"], "No");
  assert.equal(values["Rotation Item"], "No");
  assert.equal(values["IHM (Inventory of Hazardous Materials)"], "Yes");
});

test("reference metadata never substitutes another vessel, ambiguous codes, or a secondary link for an unresolved UUID", async () => {
  const records = [
    { ...spare(), componentId: "v2-a" },
    { ...spare(2), componentId: null, componentCode: "601.001" },
    { ...spare(3), fleetEquipmentCode: "different-fleet", fleetEquipmentName: null },
    { ...spare(4), componentCode: "mismatched-code" },
  ];
  const api = reader(records, [component(), component("v1", "b"), component("v2")]);
  const data = await fetchUniqueSparesData(["v1"], false, api.read);
  assert.equal(data.rows[0].component.name, "");
  assert.equal(data.rows[0].component.fleetEquipmentName, "");
  assert.equal(data.rows[1].component.name, "");
  assert.equal(data.rows[2].component.fleetEquipmentCode, "different-fleet");
  assert.equal(data.rows[2].component.fleetEquipmentName, "");
  assert.equal(data.rows[3].component.componentCode, "mismatched-code");
  assert.equal(data.rows[3].component.name, "");
  assert.equal(data.rows[3].component.fleetEquipmentCode, "");
  assert.ok(data.components.every(c => c.vesselId === "v1"));
});

test("XLSX read-back matches the existing template and retains data and dropdowns beyond row 1000", async () => {
  const template = new ExcelJS.Workbook();
  await template.xlsx.readFile("attached_assets/spares_template_(20)_1791175727961.xlsx");
  const records = Array.from({ length: 1001 }, (_, i) => spare(i + 1));
  const api = reader(records);
  const buffer = await buildUniqueSparesWorkbook(await fetchUniqueSparesData(["v1"], false, api.read)).xlsx.writeBuffer();
  assert.equal(Buffer.from(buffer).subarray(0, 4).toString("hex"), "504b0304");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map(s => s.name), template.worksheets.map(s => s.name));
  for (const name of ["Spares", "Components", "Lists"]) {
    const sheet = workbook.getWorksheet(name)!;
    const expected = template.getWorksheet(name)!;
    assert.deepEqual(sheet.getRow(1).values, expected.getRow(1).values);
    for (let column = 1; column <= (name === "Spares" ? 28 : expected.columnCount); column++) {
      assert.equal(sheet.getColumn(column).width, expected.getColumn(column).width);
      assert.deepEqual(sheet.getCell(1, column).font, expected.getCell(1, column).font);
    }
  }
  const sheet = workbook.getWorksheet("Spares")!;
  assert.equal(sheet.rowCount, 1002);
  assert.equal(sheet.getCell("A1002").value, "PT-1001");
  assert.equal(sheet.getCell("AC1").value, "_TEMPLATE_VERSION_2.0.0");
  assert.equal(sheet.getCell("D2").value, "Fleet engine a");
  assert.equal(sheet.getCell("S1002").value, 0);
  for (const column of ["I", "R", "Y", "Z", "AB"]) {
    assert.deepEqual(sheet.getCell(`${column}2`).dataValidation,
      template.getWorksheet("Spares")!.getCell(`${column}2`).dataValidation);
    assert.deepEqual(sheet.getCell(`${column}1002`).dataValidation, sheet.getCell(`${column}2`).dataValidation);
  }
  for (let row = 1; row <= 11; row++) assert.deepEqual(workbook.getWorksheet("Lists")!.getRow(row).values,
    template.getWorksheet("Lists")!.getRow(row).values);
});

test("filename follows the exact example, English months, underscore-safe vessel names and aggregate labels", () => {
  const now = new Date(2026, 9, 5, 12, 30, 45);
  assert.equal(uniqueSparesFilename("v1", [{ id: "v1", name: "Gas Mia" }], now),
    "Gas_Mia_Component_Unique_Spares_05-Oct-2026_12-30.xlsx");
  assert.equal(uniqueSparesFilename("all", [], now), "All_Vessels_Component_Unique_Spares_05-Oct-2026_12-30.xlsx");
  assert.equal(uniqueSparesFilename("my", [], now), "My_Vessels_Component_Unique_Spares_05-Oct-2026_12-30.xlsx");
  assert.equal(uniqueSparesFilename("v1", [{ id: "v1", name: ' Sea:/\\?"<>|*\u0000\tStar ' }], new Date(2026, 1, 3, 4, 5)),
    "Sea___________Star_Component_Unique_Spares_03-Feb-2026_04-05.xlsx");
  for (const vessels of [[], [{ id: "v1", name: null }], [{ id: "v1", name: " " }]]) {
    assert.throws(() => uniqueSparesFilename("v1", vessels, now), /Vessel name is unavailable/);
  }
});

test("filename uses browser-local time rather than UTC at a date boundary", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Asia/Calcutta";
    const instant = new Date("2026-10-04T19:35:06Z");
    assert.equal(uniqueSparesFilename("v1", [{ id: "v1", name: "Gas Mia" }], instant),
      "Gas_Mia_Component_Unique_Spares_05-Oct-2026_01-05.xlsx");
    process.env.TZ = "America/Los_Angeles";
    assert.equal(uniqueSparesFilename("v1", [{ id: "v1", name: "Gas Mia" }], instant),
      "Gas_Mia_Component_Unique_Spares_04-Oct-2026_12-35.xlsx");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("empty inventory produces no master rows and serialization checks scope before any download", async () => {
  const api = reader([]);
  assert.equal((await fetchUniqueSparesData(["v1"], false, api.read)).rows.length, 0);
  await assert.rejects(downloadUniqueSparesWorkbook(buildUniqueSparesWorkbook({ rows: [], components: [] }),
    "unique.xlsx", () => { throw new Error("Scope changed"); }), /Scope changed/);
});

test("browser download uses the supplied filename and genuine XLSX Blob, then removes its anchor", async () => {
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL;
  let appended = false, clicked = false, removed = false;
  const anchor = {
    href: "", download: "", click() { clicked = true; },
    remove() { removed = true; },
  };
  let downloaded: Blob | undefined;
  try {
    globalThis.document = {
      createElement: (tag: string) => { assert.equal(tag, "a"); return anchor; },
      body: { appendChild: (node: unknown) => { assert.equal(node, anchor); appended = true; } },
    } as unknown as Document;
    URL.createObjectURL = blob => {
      assert.ok(blob instanceof Blob);
      downloaded = blob;
      return originalCreate(blob);
    };
    const fname = "Gas_Mia_Component_Unique_Spares_05-Oct-2026_12-30.xlsx";
    await downloadUniqueSparesWorkbook(buildUniqueSparesWorkbook({ rows: [], components: [] }), fname, () => {});
    assert.equal(anchor.download, fname);
    assert.ok(appended && clicked && removed);
    assert.equal(downloaded?.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.equal(Buffer.from(await downloaded!.arrayBuffer()).subarray(0, 4).toString("hex"), "504b0304");
  } finally {
    globalThis.document = originalDocument;
    URL.createObjectURL = originalCreate;
  }
});
