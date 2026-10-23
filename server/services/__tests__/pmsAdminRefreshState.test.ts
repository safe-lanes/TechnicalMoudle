import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readAdminValue, updateAdminUrl } from "../../../client/src/hooks/useAdminUrlState";

const source = (file: string) => readFileSync(new URL(`../../../client/src/${file}`, import.meta.url), "utf8");

describe("PMS Admin refresh-safe browsing state", () => {
  it("restores the Admin tab and nested filters from the same URL after reload", () => {
    let url = new URL("https://example.com/pms/admin?unrelated=keep#section");
    url = updateAdminUrl(url.href, "tab", "admin-4", "");
    url = updateAdminUrl(url.href, "master.view", "rotation-items", "dashboard");
    url = updateAdminUrl(url.href, "master.rotation.vessel", "V001", "");
    url = updateAdminUrl(url.href, "master.rotation.search", "Pump & motor", "");
    expect(readAdminValue(url.search, "tab", "", ["admin-4"])).toBe("admin-4");
    expect(readAdminValue(url.search, "master.view", "dashboard")).toBe("rotation-items");
    expect(readAdminValue(url.search, "master.rotation.vessel", "")).toBe("V001");
    expect(readAdminValue(url.search, "master.rotation.search", "")).toBe("Pump & motor");
    expect(url.pathname).toBe("/pms/admin");
    expect(url.hash).toBe("#section");
    expect(url.searchParams.get("unrelated")).toBe("keep");
  });

  it("persists clear without dropping other selections", () => {
    const url = updateAdminUrl("https://example.com/pms/admin?pms.bulk.vessel=V001&pms.bulk.view=history", "bulk.vessel", "", "");
    expect(readAdminValue(url.search, "bulk.vessel", "")).toBe("");
    expect(readAdminValue(url.search, "bulk.view", "upload")).toBe("history");
  });

  it("rejects unknown tab and enum values", () => {
    expect(readAdminValue("?pms.tab=bogus", "tab", "alerts", ["alerts", "admin-4"])).toBe("alerts");
    expect(readAdminValue("?pms.bulk.fleet=garbage", "bulk.fleet", false)).toBe(false);
    expect(readAdminValue("?pms.master.rotation.status=bogus", "master.rotation.status", "all", ["all", "Spare"])).toBe("all");
  });

  it.each(["-1", "NaN", "Infinity", "1.5", "", "9007199254740993"])("rejects invalid page %s", value => {
    expect(readAdminValue(`?pms.bulk.history.page=${value}`, "bulk.history.page", 0)).toBe(0);
  });

  it("restores fleet mode and pagination without restoring mutation state", () => {
    expect(readAdminValue("?pms.bulk.fleet=true", "bulk.fleet", false)).toBe(true);
    expect(readAdminValue("?pms.bulk.history.page=3", "bulk.history.page", 0)).toBe(3);
    expect(readAdminValue(`?pms.master.makers.search=${"x".repeat(1001)}`, "master.makers.search", "")).toBe("");
  });

  it("wires permission-safe parent and child navigation", () => {
    const admin = source("pages/pms/PMSAdmin.tsx");
    expect(admin).toContain('if (!uiRole)');
    expect(admin).toContain('requestedTab === "admin-4" && !showMasterData');
    expect(admin).toContain('isExternal ? "bulk-data-imp"');
    expect(admin).not.toContain('setActiveTab("alerts")');
    expect(source("pages/admin/Admin4Dashboard.tsx")).toContain('"master.view"');
    expect(source("pages/admin/BulkDataImport.tsx")).toContain("onVesselChange={setSelectedVessel}");
  });

  it("uses one vessel value in overview history, not an initialized-once copy", () => {
    const history = source("pages/admin/bulk/BulkImportHistory.tsx");
    expect(history).toContain('(onVesselChange ? vesselId : storedVessel) || "all"');
    expect(history).not.toContain("useState<string>(vesselId");
    expect(history).toContain("if (historyData && page >= Math.max(1, totalPages))");
  });

  it("does not clear dynamic Master List options before they arrive", () => {
    const lists = source("pages/admin/MasterListsManagement.tsx");
    expect(lists.indexOf("if (!allTypes) return;")).toBeLessThan(lists.indexOf("if (typesForCurrentSection.length === 0)"));
  });

  it("keeps uploads, dry runs and Undo transient", () => {
    const upload = source("components/admin/UniformBulkUpload.tsx");
    expect(upload).toMatch(/\[selectedFile, setSelectedFile\] = useState/);
    expect(upload).toMatch(/\[dryRunResult, setDryRunResult\] = useState/);
    expect(upload).toMatch(/\[activeTab, setActiveTab\] = useAdminUrlState/);
    expect(source("hooks/useAdminUrlState.ts")).toContain('window.addEventListener("popstate", notify)');
    expect(source("hooks/useAdminUrlState.ts")).toContain('window.location.search, key, fallback, choices');
  });
});
