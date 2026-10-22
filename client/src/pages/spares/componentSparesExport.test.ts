import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import {
  buildComponentSparesWorkbook, componentSpareValues, componentSparesVesselIds,
  fetchComponentSparesData, downloadComponentSparesWorkbook, componentSparesFilename,
} from "./componentSparesExport";
import { SPARES_TEMPLATE_FIELDS } from "@shared/sparesTemplateFields";

test("filename uses the selected vessel display name with the exact requested format", () => {
  const now = new Date(2026, 9, 5, 14, 30, 45);
  assert.equal(componentSparesFilename("v2", [
    { id: "v1", name: "Other Vessel" }, { id: "v2", name: "Example Vessel" },
  ], now), "Example Vessel_Component_Spares_05-10-2026_14-30-45.xlsx");
});

test("filename preserves spaces and replaces every filesystem-unsafe character", () => {
  const now = new Date(2026, 9, 5, 14, 30, 45);
  for (const unsafe of ['<', '>', ':', '"', '/', '\\', '|', '?', '*', '\u0000', '\u001f']) {
    assert.equal(componentSparesFilename("v1", [{ id: "v1", name: `Sea${unsafe} Star` }], now),
      "Sea_ Star_Component_Spares_05-10-2026_14-30-45.xlsx");
  }
  assert.equal(componentSparesFilename("v1", [{ id: "v1", name: "  Sea Star  " }], now),
    "Sea Star_Component_Spares_05-10-2026_14-30-45.xlsx");
});

test("aggregate filenames describe All and My Vessels rather than a single vessel", () => {
  const now = new Date(2026, 1, 3, 4, 5, 6);
  assert.equal(componentSparesFilename("all", [], now),
    "All_Vessels_Component_Spares_03-02-2026_04-05-06.xlsx");
  assert.equal(componentSparesFilename("my", [], now),
    "My_Vessels_Component_Spares_03-02-2026_04-05-06.xlsx");
});

test("filename uses browser-local date and time across a UTC date boundary", () => {
  const previousTimezone = process.env.TZ;
  try {
    process.env.TZ = "Asia/Calcutta";
    const instant = new Date("2026-10-04T19:35:06Z");
    assert.equal(componentSparesFilename("v1", [{ id: "v1", name: "Sea Star" }], instant),
      "Sea Star_Component_Spares_05-10-2026_01-05-06.xlsx");
    process.env.TZ = "America/Los_Angeles";
    assert.equal(componentSparesFilename("v1", [{ id: "v1", name: "Sea Star" }], instant),
      "Sea Star_Component_Spares_04-10-2026_12-35-06.xlsx");
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("missing vessel names raise a clear error instead of silently naming files with a UUID", () => {
  for (const vessels of [[], [{ id: "v1" }], [{ id: "v1", name: null }], [{ id: "v1", name: "  " }]]) {
    assert.throws(() => componentSparesFilename("v1", vessels), /Vessel name is unavailable/);
  }
  assert.throws(() => componentSparesFilename("unknown", [{ id: "v1", name: "Sea Star" }]),
    /Vessel name is unavailable/);
});

const component = (vesselId = "v1", suffix = "a") => ({
  id: `legacy-${vesselId}-${suffix}`, cuuid: `${vesselId}-${suffix}`, vesselId,
  componentCode: "601.001", name: `Engine ${suffix}`, fleetEquipmentCode: `fleet-${suffix}`,
  fleetEquipmentName: `Fleet engine ${suffix}`, category: "Machinery", isActive: true,
});
const spare = (id = 1, vesselId = "v1") => ({
  id, suuid: `${vesselId}-spare-${id}`, vesselId, partCode: `PT-${id}`,
  partName: `Spare ${id}`, componentName: "Wrong primary component",
  componentCode: "WRONG", fleetEquipmentCode: "WRONG", rob: 0,
  robLocationA: 0, robLocationB: 0, min: 0, isActive: true, isRotationItem: true,
  critical: "Non-Critical", ihm: "No", uom: "PCS",
});
const link = (id = 1, vesselId = "v1", suffix = "a") => ({
  spareId: id, spareUuid: `${vesselId}-spare-${id}`, vesselId, componentId: `${vesselId}-${suffix}`,
});
function reader(
  spares: Record<string, any>[], links: Record<string, any>[],
  components = [component()], details: Record<string, any> = {},
) {
  const calls: string[] = [];
  return {
    calls,
    read: async (url: string) => {
      calls.push(url);
      const parsed = new URL(url, "http://test");
      const vessel = parsed.pathname.split("/").pop()!;
      if (url.includes("/components/")) return components.filter(c => c.vesselId === vessel);
      if (url.includes("/spare-links/")) return { data: links.filter(l => l.vesselId === vessel) };
      if (url.includes("/spares-with-inventory/")) {
        const eligible = spares.filter(s => s.vesselId === vessel &&
          (!parsed.searchParams.has("activeOnly") || s.isActive !== false));
        const page = Number(parsed.searchParams.get("page"));
        // A small server page exercises following the actual received page length.
        return { data: { items: eligible.slice((page - 1) * 2, page * 2).map(s => ({ spare: s })),
          total: eligible.length } };
      }
      if (url.includes("/spares/")) {
        if (!details[vessel]) throw Object.assign(new Error("Spare not found"), { status: 404 });
        return details[vessel];
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  };
}

test("all pages export actual data, not grid placeholders; links use their own components", async () => {
  const spares = [spare(1), spare(2), spare(3), spare(4), spare(5)];
  const api = reader(spares, [...spares.map(s => link(s.id)), link(1, "v1", "b")],
    [component(), component("v1", "b")]);
  const data = await fetchComponentSparesData(["v1"], false, api.read);
  assert.equal(data.rows.length, 6);
  assert.equal(data.rows[4].spare.partName, "Spare 5");
  assert.equal(data.rows[5].component.fleetEquipmentName, "Fleet engine b");
  assert.equal(api.calls.filter(c => c.includes("spares-with-inventory")).length, 3);
  api.calls.forEach(url => {
    assert.ok(!/[?&](search|componentId|stockStatus|criticality|rotation)=/.test(url));
  });
});

test("scope resolution handles single, all and my without using aggregate link endpoints", async () => {
  assert.deepEqual(componentSparesVesselIds("my", true, ["v2", "v2"], ["v1", "v2"]), ["v2"]);
  assert.deepEqual(componentSparesVesselIds("all", false, [], ["v1", "v2"]), ["v1", "v2"]);
  assert.deepEqual(componentSparesVesselIds("v1", false, [], ["v2"]), ["v1"]);
  assert.deepEqual(componentSparesVesselIds("my", true, [], ["v1"]), []);
  const api = reader([spare(1), spare(1, "v2")], [link(), link(1, "v2")],
    [component(), component("v2")]);
  const data = await fetchComponentSparesData(["v1", "v2"], false, api.read);
  assert.equal(data.rows.length, 2);
  assert.deepEqual(data.rows.map(r => r.spare.vesselId), ["v1", "v2"]);
  assert.ok(api.calls.every(url => !/\/(all|my)(\?|$)/.test(url)));
  const my = await fetchComponentSparesData(["v2"], false, api.read);
  assert.equal(my.rows[0].spare.vesselId, "v2");
});

test("inactive/deleted records are deliberately excluded without placeholder rows", async () => {
  const inactiveSpare = { ...spare(2), isActive: false };
  const deletedSpare = { ...spare(3), deleted: true };
  const deletedComponent = { ...component("v1", "b"), isDeleted: true };
  const inactiveComponent = { ...component("v1", "c"), isActive: false };
  const api = reader([spare(), inactiveSpare],
    [link(), link(2), link(3), link(1, "v1", "b"), link(1, "v1", "c"), { ...link(4), isDeleted: true }],
    [component(), deletedComponent, inactiveComponent],
    { "v1-spare-2": inactiveSpare });
  const data = await fetchComponentSparesData(["v1"], true, api.read);
  assert.equal(data.rows.length, 1);
  assert.equal(data.excludedUnavailableSpareLinks, 1);
  assert.equal(data.components.length, 1);
  assert.ok(api.calls.some(c => c.includes("activeOnly=true")));
  const office = await fetchComponentSparesData(["v1"], false, api.read);
  assert.equal(office.rows.length, 3);
  assert.equal(office.excludedUnavailableSpareLinks, 1);
});

test("unresolved links, incorrect UUIDs, cross-vessel records and fetch failures fail explicitly", async () => {
  const missing = reader([spare()], [link(9)]);
  await assert.rejects(fetchComponentSparesData(["v1"], false, async url => {
    if (url.includes("/spares/")) throw new Error("Network failure resolving spare");
    return missing.read(url);
  }), /Network failure/);
  const wrongUUID = reader([spare()], [{ ...link(), spareUuid: "wrong-uuid" }]);
  await assert.rejects(fetchComponentSparesData(["v1"], false, wrongUUID.read));
  const missingComponent = reader([spare()], [link(1, "v1", "missing")]);
  await assert.rejects(fetchComponentSparesData(["v1"], false, missingComponent.read), /component.*resolved/);
  const api = reader([spare()], [link()]);
  await assert.rejects(fetchComponentSparesData(["v1"], false, async url => {
    if (url.includes("spare-links")) return { data: [link(1, "v2")] };
    return api.read(url);
  }), /different vessel/);
  await assert.rejects(fetchComponentSparesData(["v1"], false, async () => {
    throw new Error("Network failure");
  }), /Network failure/);
});

test("retained deleted-spare links do not block valid rows when both detail identities return 404", async () => {
  const api = reader([spare()], [link(), link(2), link(2, "v1", "b")]);
  const data = await fetchComponentSparesData(["v1"], false, api.read);
  assert.equal(data.rows.length, 1);
  assert.equal(data.rows[0].spare.partCode, "PT-1");
  assert.equal(data.excludedUnavailableSpareLinks, 2);
  assert.equal(api.calls.filter(url => url.includes("/spares/v1/v1-spare-2")).length, 1);
  assert.equal(api.calls.filter(url => url.includes("/spares/v1/2")).length, 1);
});

test("404 does not justify omitting a link with an existing inconsistent numeric identity", async () => {
  const api = reader([spare()], [link(2)],
    [component()], { "2": { ...spare(2), suuid: "a-different-uuid" } });
  await assert.rejects(fetchComponentSparesData(["v1"], false, api.read), /could not be resolved/);
  const invalid = reader([spare()], [{ ...link(2), spareId: null, spareUuid: null }]);
  await assert.rejects(fetchComponentSparesData(["v1"], false, invalid.read), /invalid identity/);
  const failure = reader([spare()], [link(2)]);
  await assert.rejects(fetchComponentSparesData(["v1"], false, async url => {
    if (url.endsWith("/spares/v1/2")) throw Object.assign(new Error("Server error"), { status: 500 });
    return failure.read(url);
  }), /Server error/);
});

test("component links hidden/deleted by the component API are excluded only with same-vessel inventory evidence", async () => {
  const api = reader([spare()], [link(), link(1, "v1", "hidden")]);
  const read = async (url: string) => {
    const result = await api.read(url);
    if (url.includes("spares-with-inventory")) {
      result.data.items[0].linkedComponents = [
        { componentId: "v1-a" }, { componentId: "v1-hidden" },
      ];
    }
    return result;
  };
  const data = await fetchComponentSparesData(["v1"], true, read);
  assert.equal(data.rows.length, 1);
  assert.equal(data.rows[0].component.cuuid, "v1-a");
});

test("empty, partial and changing responses cannot be treated as complete exports", async () => {
  const empty = reader([], []);
  assert.equal((await fetchComponentSparesData(["v1"], false, empty.read)).rows.length, 0);
  const api = reader([spare(), spare(2), spare(3)], [link()]);
  await assert.rejects(fetchComponentSparesData(["v1"], false, async url => {
    const response = await api.read(url);
    if (url.includes("page=2")) response.data.total = 4;
    return response;
  }), /Inventory changed/);
  await assert.rejects(fetchComponentSparesData(["v1"], false, async url => {
    const response = await api.read(url);
    if (url.includes("spares-with-inventory")) response.data.items = [];
    return response;
  }), /Incomplete/);
  let current = true;
  await assert.rejects(fetchComponentSparesData(["v1"], false, async url => {
    const result = await api.read(url);
    current = false;
    return result;
  }, () => { if (!current) throw new Error("Scope changed"); }), /Scope changed/);
});

test("mapping preserves zero quantities, optional blanks and inactive status without primary-component fallback", () => {
  const values = componentSpareValues({ ...spare(), isActive: false, pageNumber: 0 }, component("v1", "b"));
  const row = Object.fromEntries(SPARES_TEMPLATE_FIELDS.map((f, index) => [f.header, values[index]]));
  assert.equal(row["Fleet Equipment Name"], "Fleet engine b");
  assert.equal(row["Component Name"], "Engine b");
  for (const key of ["Total ROB", "Location A - ROB", "Location B - ROB", "Minimum Stock", "Page Number"]) {
    assert.equal(row[key], 0);
  }
  assert.equal(row["Criticality"], "No");
  assert.equal(row["Is Active"], "No");
  assert.equal(row["Rotation Item"], "Yes");
  assert.equal(row["Note"], "");
  assert.equal(row["Reserved"], "");
});

test("XLSX read-back matches uploaded template sheets, headers, widths, style, lists and dropdowns", async () => {
  const reference = new ExcelJS.Workbook();
  await reference.xlsx.readFile("attached_assets/spares_template_(20)_1791175727961.xlsx");
  const data = {
    rows: Array.from({ length: 1001 }, () => ({ spare: spare(), component: component() })),
    components: [component()],
  };
  const workbook = buildComponentSparesWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  assert.equal(Buffer.from(buffer).subarray(0, 4).toString("hex"), "504b0304");
  const actual = new ExcelJS.Workbook();
  await actual.xlsx.load(buffer);
  assert.deepEqual(actual.worksheets.map(s => s.name), reference.worksheets.map(s => s.name));
  for (const name of ["Spares", "Components", "Lists"]) {
    const sheet = actual.getWorksheet(name)!;
    const expected = reference.getWorksheet(name)!;
    assert.deepEqual(sheet.getRow(1).values, expected.getRow(1).values);
    for (let column = 1; column <= (name === "Spares" ? 28 : expected.columnCount); column++) {
      assert.equal(sheet.getColumn(column).width, expected.getColumn(column).width);
      assert.deepEqual(sheet.getCell(1, column).font, expected.getCell(1, column).font);
    }
  }
  const sheet = actual.getWorksheet("Spares")!;
  assert.equal(sheet.getCell("AC1").value, "_TEMPLATE_VERSION_2.0.0");
  assert.equal(sheet.rowCount, 1002);
  assert.equal(sheet.getCell("S2").value, 0);
  for (const column of ["I", "R", "Y", "Z", "AB"]) {
    assert.deepEqual(sheet.getCell(`${column}2`).dataValidation,
      reference.getWorksheet("Spares")!.getCell(`${column}2`).dataValidation);
    assert.deepEqual(sheet.getCell(`${column}1002`).dataValidation, sheet.getCell(`${column}2`).dataValidation);
  }
  for (let row = 1; row <= 11; row++) {
    assert.deepEqual(actual.getWorksheet("Lists")!.getRow(row).values,
      reference.getWorksheet("Lists")!.getRow(row).values);
  }
  assert.equal(actual.getWorksheet("Components")!.getCell("B2").value, "Engine a");
});

test("scope changes while serializing prevent the browser download", async () => {
  await assert.rejects(downloadComponentSparesWorkbook(
    buildComponentSparesWorkbook({ rows: [], components: [] }),
    "component_spares_v1.xlsx",
    () => { throw new Error("Scope changed"); },
  ), /Scope changed/);
});
