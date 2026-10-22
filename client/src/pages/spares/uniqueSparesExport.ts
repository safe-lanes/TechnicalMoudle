import {
  buildComponentSparesWorkbook, downloadComponentSparesWorkbook,
} from "./componentSparesExport";

type ExportRecord = Record<string, any>;
export interface UniqueSparesData {
  rows: { spare: ExportRecord; component: ExportRecord }[];
  components: ExportRecord[];
}

const deleted = (record: ExportRecord) => record.deleted === true || record.isDeleted === true;
const eligible = (record: ExportRecord, activeOnly: boolean) =>
  !deleted(record) && record.dataScope !== "fleet" && (!activeOnly || record.isActive !== false);

export function uniqueSparesVesselIds(
  vesselId: string, isMyVessels: boolean, assignedIds: string[], availableIds: string[],
) {
  const ids = isMyVessels ? assignedIds : vesselId === "all" ? availableIds : [vesselId];
  return Array.from(new Set(ids.filter(id => id && id !== "all" && id !== "my")));
}

export function uniqueSparesFilename(
  vesselId: string, vessels: ReadonlyArray<{ id: string; name?: string | null }>, now = new Date(),
) {
  const name = vesselId === "all" ? "All_Vessels" : vesselId === "my" ? "My_Vessels"
    : vessels.find(vessel => vessel.id === vesselId)?.name?.trim();
  if (!name) throw new Error("Vessel name is unavailable. Please wait for the vessel list to load and try exporting again.");
  const safeName = name.replace(/[\s<>:"/\\|?*\u0000-\u001f]/g, "_");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = `${String(now.getDate()).padStart(2, "0")}-${months[now.getMonth()]}-${String(now.getFullYear()).padStart(4, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  return `${safeName}_Component_Unique_Spares_${date}_${time}.xlsx`;
}

// Preserve master-record values, filling missing reference metadata only from its
// primary component. Never choose one of the secondary links or another vessel.
function masterReference(spare: ExportRecord, primary?: ExportRecord): ExportRecord {
  const savedCode = spare.fleetEquipmentCode;
  const canUsePrimaryFleetName = !savedCode || savedCode === primary?.fleetEquipmentCode;
  return {
    componentCode: spare.componentCode || primary?.componentCode || "",
    name: spare.componentName || primary?.name || "",
    fleetEquipmentCode: savedCode || primary?.fleetEquipmentCode || "",
    fleetEquipmentName: spare.fleetEquipmentName ||
      (canUsePrimaryFleetName ? primary?.fleetEquipmentName : "") || "",
  };
}

export async function fetchUniqueSparesData(
  vesselIds: string[], activeOnly: boolean, readJson: (url: string) => Promise<any>,
  assertCurrent: () => void = () => {},
): Promise<UniqueSparesData> {
  const rows: UniqueSparesData["rows"] = [];
  const components: ExportRecord[] = [];
  for (const vesselId of Array.from(new Set(vesselIds))) {
    if (!vesselId || vesselId === "all" || vesselId === "my") {
      throw new Error("A concrete vessel is required to fetch unique spares.");
    }
    assertCurrent();
    const encodedVessel = encodeURIComponent(vesselId);
    const rawComponents = await readJson(`/technical/api/components/${encodedVessel}`);
    assertCurrent();
    if (!Array.isArray(rawComponents)) throw new Error("Invalid component response. Export was not downloaded.");
    const componentById = new Map<string, ExportRecord>();
    const componentsByCode = new Map<string, ExportRecord[]>();
    for (const component of rawComponents) {
      if (component.vesselId !== vesselId || !eligible(component, activeOnly)) continue;
      if (component.cuuid) componentById.set(component.cuuid, component);
      if (component.id) componentById.set(component.id, component);
      if (component.componentCode && component.name) {
        components.push(component);
        const matching = componentsByCode.get(component.componentCode) || [];
        matching.push(component);
        componentsByCode.set(component.componentCode, matching);
      }
    }
    const seenIds = new Set<number>();
    const seenUuids = new Set<string>();
    const seenCodes = new Set<string>();
    let expectedTotal: number | undefined;
    let loaded = 0;
    for (let page = 1; ; page++) {
      assertCurrent();
      const params = new URLSearchParams({ page: String(page), pageSize: "200" });
      if (activeOnly) params.set("activeOnly", "true");
      const response = await readJson(
        `/technical/api/inventory/spares-with-inventory/${encodedVessel}?${params}`,
      );
      assertCurrent();
      const payload = response?.data;
      if (response?.success === false || !Array.isArray(payload?.items) ||
          !Number.isInteger(payload.total) || payload.total < 0) {
        throw new Error("Invalid spare inventory response. Export was not downloaded.");
      }
      expectedTotal ??= payload.total;
      const total: number = payload.total;
      if (expectedTotal !== total) throw new Error("Inventory changed during export. Please try again.");
      for (const item of payload.items) {
        const spare = item?.spare;
        if (!spare || spare.vesselId !== vesselId || !Number.isInteger(spare.id) || spare.id <= 0) {
          throw new Error("A spare could not be resolved within the selected vessel scope.");
        }
        if (seenIds.has(spare.id) || (spare.suuid && seenUuids.has(spare.suuid))) {
          throw new Error("Inventory changed during export. Please try again.");
        }
        seenIds.add(spare.id);
        if (spare.suuid) seenUuids.add(spare.suuid);
        if (!eligible(spare, activeOnly)) continue;
        if (typeof spare.partCode !== "string" || !spare.partCode.trim()) {
          throw new Error("A spare has no part code. Unique spares could not be verified.");
        }
        if (seenCodes.has(spare.partCode)) continue;
        seenCodes.add(spare.partCode);
        // An unresolved UUID must not fall back to a coincidentally matching code.
        const codeMatches = componentsByCode.get(spare.componentCode) || [];
        const candidate = spare.componentId ? componentById.get(spare.componentId)
          : codeMatches.length === 1 ? codeMatches[0] : undefined;
        const primary = !spare.componentCode || spare.componentCode === candidate?.componentCode
          ? candidate : undefined;
        rows.push({ spare, component: masterReference(spare, primary) });
      }
      loaded += payload.items.length;
      if (loaded === total) break;
      if (!payload.items.length || loaded > total) {
        throw new Error("Incomplete spare inventory response. Export was not downloaded.");
      }
    }
  }
  assertCurrent();
  return { rows, components };
}

// Reuse only the unchanged pure template builder and browser download mechanism.
// Unique Spares has its own data source; it never fetches component-spare links.
export function buildUniqueSparesWorkbook(data: UniqueSparesData) {
  return buildComponentSparesWorkbook(data);
}

export const downloadUniqueSparesWorkbook = downloadComponentSparesWorkbook;
