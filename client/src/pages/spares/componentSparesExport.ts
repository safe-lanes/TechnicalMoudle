import ExcelJS from "exceljs";
import { SPARES_TEMPLATE_FIELDS } from "@shared/sparesTemplateFields";

// This module belongs exclusively to Export Component Spares.
type ExportRecord = Record<string, any>;
type ReadJson = (url: string) => Promise<any>;
export interface ComponentSparesData {
  rows: { spare: ExportRecord; component: ExportRecord }[];
  components: ExportRecord[];
  excludedUnavailableSpareLinks?: number;
}

const deleted = (record: ExportRecord) => record.deleted === true || record.isDeleted === true;
const inactive = (record: ExportRecord) => record.isActive === false;

export function componentSparesVesselIds(
  vesselId: string, isMyVessels: boolean, assignedIds: string[], pickerIds: string[],
) {
  const ids = isMyVessels ? assignedIds : vesselId === "all" ? pickerIds : [vesselId];
  return Array.from(new Set(ids.filter(id => id && id !== "all" && id !== "my")));
}

export async function fetchComponentSparesData(
  vesselIds: string[],
  activeOnly: boolean,
  readJson: ReadJson,
  assertCurrent: () => void = () => {},
): Promise<ComponentSparesData> {
  const rows: ComponentSparesData["rows"] = [];
  const components: ExportRecord[] = [];
  let excludedUnavailableSpareLinks = 0;
  for (const vesselId of vesselIds) {
    assertCurrent();
    const encodedVessel = encodeURIComponent(vesselId);
    const [rawComponents, linkResponse] = await Promise.all([
      readJson(`/technical/api/components/${encodedVessel}`),
      readJson(`/technical/api/inventory/spare-links/${encodedVessel}`),
    ]);
    assertCurrent();
    if (!Array.isArray(rawComponents) || !Array.isArray(linkResponse?.data)) {
      throw new Error("Invalid component or spare-link response. Export was not downloaded.");
    }
    const componentById = new Map<string, ExportRecord>();
    for (const component of rawComponents) {
      if (component.vesselId !== vesselId || component.dataScope === "fleet") continue;
      if (component.cuuid) componentById.set(component.cuuid, component);
      if (component.id) componentById.set(component.id, component);
      if (!deleted(component) && (!activeOnly || !inactive(component)) &&
          component.componentCode && component.name) components.push(component);
    }
    // Read every page independently of the grid's search and filter state.
    const spareByUuid = new Map<string, ExportRecord>();
    const spareById = new Map<number, ExportRecord>();
    const knownLinkedComponents = new Map<number, Set<string>>();
    let expectedTotal: number | undefined;
    let loaded = 0;
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ page: String(page), pageSize: "200" });
      if (activeOnly) params.set("activeOnly", "true");
      const response = await readJson(
        `/technical/api/inventory/spares-with-inventory/${encodedVessel}?${params}`,
      );
      assertCurrent();
      const payload = response?.data;
      if (!Array.isArray(payload?.items) || !Number.isInteger(payload.total) || payload.total < 0) {
        throw new Error("Invalid spare inventory response. Export was not downloaded.");
      }
      expectedTotal ??= payload.total;
      const total: number = payload.total;
      if (expectedTotal !== payload.total) {
        throw new Error("Inventory changed during export. Please try again.");
      }
      for (const item of payload.items) {
        const spare = item.spare;
        if (!spare || spare.vesselId !== vesselId || !Number.isInteger(spare.id)) {
          throw new Error("A spare could not be resolved within the selected vessel scope.");
        }
        if (spareById.has(spare.id)) {
          throw new Error("Inventory changed during export. Please try again.");
        }
        spareById.set(spare.id, spare);
        if (spare.suuid) spareByUuid.set(spare.suuid, spare);
        knownLinkedComponents.set(spare.id, new Set(
          (Array.isArray(item.linkedComponents) ? item.linkedComponents : [])
            .map((linked: ExportRecord) => linked.componentId),
        ));
      }
      loaded += payload.items.length;
      if (loaded === total) break;
      if (!payload.items.length || loaded > total) {
        throw new Error("Incomplete spare inventory response. Export was not downloaded.");
      }
    }
    const missingSpares = new Map<string, ExportRecord>();
    const unavailableSpareIdentities = new Set<string>();
    const seenLinks = new Set<string>();
    for (const link of linkResponse.data) {
      if (link.vesselId !== vesselId) {
        throw new Error("A spare linkage belongs to a different vessel. Export was not downloaded.");
      }
      if (deleted(link)) continue;
      // UUID is authoritative; an existing UUID must never fall back to another numeric ID.
      let spare = link.spareUuid
        ? spareByUuid.get(link.spareUuid)
        : spareById.get(Number(link.spareId));
      if (!spare) {
        const numericId = Number(link.spareId);
        if (!Number.isInteger(numericId) || numericId <= 0 ||
            (link.spareUuid != null && (typeof link.spareUuid !== "string" || !link.spareUuid.trim()))) {
          throw new Error("A spare linkage has an invalid identity. Export was not downloaded.");
        }
        // A wrong UUID pointing to a known eligible numeric ID is a broken identity,
        // not evidence of deletion. Never silently omit it or substitute that spare.
        if (link.spareUuid && spareById.has(numericId)) {
          throw new Error(`Spare linkage ${link.spareUuid} has an inconsistent identity. Export was not downloaded.`);
        }
        const identity = String(link.spareUuid || link.spareId);
        if (unavailableSpareIdentities.has(identity)) {
          excludedUnavailableSpareLinks++;
          continue;
        }
        spare = missingSpares.get(identity);
        if (!spare) {
          const readDetail = (id: string) =>
            readJson(`/technical/api/spares/${encodedVessel}/${encodeURIComponent(id)}`);
          try {
            spare = await readDetail(identity);
          } catch (error) {
            assertCurrent();
            if ((error as { status?: number })?.status !== 404) throw error;
            // This API hides retained-deleted spares with 404. Confirm BOTH identities
            // are unavailable before excluding a link absent from the complete eligible
            // inventory. A 404 alone cannot distinguish deletion from a true orphan:
            // report unavailable-link exclusions explicitly, never label them deleted.
            if (link.spareUuid) {
              try {
                spare = await readDetail(String(numericId));
              } catch (numericError) {
                assertCurrent();
                if ((numericError as { status?: number })?.status !== 404) throw numericError;
                unavailableSpareIdentities.add(identity);
              }
            } else {
              unavailableSpareIdentities.add(identity);
            }
          }
          assertCurrent();
          if (unavailableSpareIdentities.has(identity)) {
            excludedUnavailableSpareLinks++;
            continue;
          }
          if (!spare || spare.vesselId !== vesselId ||
              (link.spareUuid && spare.suuid !== link.spareUuid)) {
            throw new Error(`Spare linkage ${identity} could not be resolved in the selected vessel.`);
          }
          missingSpares.set(identity, spare);
        }
        if (!deleted(spare) && !(activeOnly && inactive(spare))) {
          throw new Error(`Spare ${spare.partCode || identity} was missing from the complete inventory. Please retry.`);
        }
      }
      if (deleted(spare) || (activeOnly && inactive(spare))) continue;
      const component = componentById.get(link.componentId);
      if (!component) {
        // The inventory API proves the component exists in this vessel, while
        // the component list deliberately omits deleted/role-hidden records.
        // Exclude that linkage; genuinely dangling links still fail explicitly.
        if (knownLinkedComponents.get(spare.id)?.has(link.componentId)) continue;
        throw new Error(`Linked component for spare ${spare.partCode} could not be resolved. Export was not downloaded.`);
      }
      if (deleted(component) || (activeOnly && inactive(component))) continue;
      if (!component.componentCode || !component.name || !spare.partCode || !spare.partName) {
        throw new Error(`Spare ${spare.partCode || link.spareId} has incomplete component or spare details.`);
      }
      const key = `${spare.suuid || spare.id}|${component.cuuid || component.id}`;
      if (seenLinks.has(key)) {
        throw new Error(`Duplicate component linkage for spare ${spare.partCode}. Export was not downloaded.`);
      }
      seenLinks.add(key);
      rows.push({ spare, component });
    }
  }
  assertCurrent();
  return { rows, components, excludedUnavailableSpareLinks };
}

function yesNo(value: unknown) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).trim().toLowerCase();
  if (["yes", "y", "true", "1", "critical", "present"].includes(normalized)) return "Yes";
  if (["no", "n", "false", "0", "non-critical", "non critical", "not present"].includes(normalized)) return "No";
  return String(value);
}

export function componentSpareValues(spare: ExportRecord, component: ExportRecord) {
  const values: ExportRecord = {
    ...spare,
    reserved: "",
    fleetEquipmentCode: component.fleetEquipmentCode ?? "",
    fleetEquipmentName: component.fleetEquipmentName ?? "",
    componentCode: component.componentCode,
    componentName: component.name,
    drawingNumber: spare.drawingNumber ?? spare.drawingNo ?? "",
    criticality: yesNo(spare.critical ?? spare.criticality),
    totalRob: spare.rob,
    locationA: spare.location,
    locationARob: spare.robLocationA,
    locationB: spare.location2,
    locationBRob: spare.robLocationB,
    minimumStock: spare.min,
    isActive: spare.isActive == null ? "Yes" : yesNo(spare.isActive),
    ihm: yesNo(spare.ihm ?? spare.ihmPresence),
    isRotationItem: spare.isRotationItem == null ? "No" : yesNo(spare.isRotationItem),
  };
  return SPARES_TEMPLATE_FIELDS.map(field => values[field.key] ?? "");
}

export function buildComponentSparesWorkbook(data: ComponentSparesData) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Spares");
  sheet.columns = SPARES_TEMPLATE_FIELDS.map(field => ({ header: field.header, width: field.width }));
  sheet.getCell("AC1").value = "_TEMPLATE_VERSION_2.0.0";
  sheet.getRow(1).font = { bold: true };
  const reference = workbook.addWorksheet("Components");
  reference.columns = [
    { header: "Component Code", width: 20 },
    { header: "Component Name", width: 40 },
    { header: "Category", width: 35 },
    { header: "Fleet Equipment Code", width: 20 },
    { header: "Fleet Equipment Name", width: 30 },
  ];
  reference.getRow(1).font = { bold: true };
  data.components.forEach(component => {
    reference.addRow([
      component.componentCode ?? "", component.name ?? "", component.category ?? "",
      component.fleetEquipmentCode ?? "", component.fleetEquipmentName ?? "",
    ]);
  });
  const lists = workbook.addWorksheet("Lists");
  lists.columns = [{ header: "UOM", width: 15 }, { header: "Yes/No", width: 15 }];
  lists.getRow(1).font = { bold: true };
  ["PCS", "SET", "LTR", "KG", "M", "BOX", "ROLL", "PACK", "KIT", "OTHER"].forEach((uom, index) => {
    lists.getCell(index + 2, 1).value = uom;
  });
  lists.getCell("B2").value = "Yes";
  lists.getCell("B3").value = "No";
  data.rows.forEach(({ spare, component }) => {
    const row = sheet.addRow(componentSpareValues(spare, component));
    for (const column of [9, 18, 25, 26, 28]) {
      row.getCell(column).dataValidation = {
        type: "list", allowBlank: true,
        formulae: [column === 9 ? "=Lists!$A$2:$A$11" : "=Lists!$B$2:$B$3"],
      };
    }
  });
  return workbook;
}

export async function downloadComponentSparesWorkbook(
  workbook: ExcelJS.Workbook, filename: string, assertCurrent: () => void,
) {
  const buffer = await workbook.xlsx.writeBuffer();
  assertCurrent();
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
