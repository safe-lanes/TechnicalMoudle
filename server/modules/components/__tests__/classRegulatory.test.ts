import { beforeEach, describe, expect, it, vi } from "vitest";
import { classRegulatoryInput, classSurveyDay, validateClassRegulatoryDates } from "@shared/classRegulatory";
import { verifiedSectionHActor, sectionHCanEdit } from "../services/classRegulatoryAccess";
import { validateIdentityMap, regulatorySnapshotHash } from "../../../../scripts/reconcile-section-h";
import { getTableSyncConfig, requiresFieldLogging } from "@shared/syncConfig";

const mocks = vi.hoisted(() => ({
  getRoleByName: vi.fn(), getRoleMenuPermissions: vi.fn(), getActiveMenuItems: vi.fn(),
}));
vi.mock("../../../storage", () => ({ storage: mocks }));
// Avoid importing the operator script's DB seam into a pure validation test.
vi.mock("../../../db", () => ({ getPool: vi.fn(), getDb: vi.fn() }));

const id = "8eb5b00d-55cb-4c0f-8b62-000000000190";
function request(overrides: Record<string, any> = {}) {
  return {
    user: { userUuid: id }, rbac: { source: "forwarded", role: "Editor", userType: "Office" },
    headers: { "x-user-id": id, "x-user-role": "Editor", "x-user-type": "Office" },
    verifiedUser: { userId: id, role: "Editor", userType: "Office", missing: [] }, ...overrides,
  } as any;
}
describe("Section H verified Office entitlement", () => {
  beforeEach(() => vi.clearAllMocks());
  it("accepts matching verified claims without relying on mock role", () => {
    expect(verifiedSectionHActor(request())).toEqual({ userId: id, role: "Editor", userType: "Office", canEdit: false, identityMode: "verified" });
  });
  it.each(["mock"])("refuses source %s even with a verified privileged-sounding identity", source => {
    expect(() => verifiedSectionHActor(request({ rbac: { source, role: "Sail Admin", userType: "Office" } }))).toThrow();
  });
  it("rejects headers without JWT-verified context", () => {
    expect(() => verifiedSectionHActor(request({ verifiedUser: undefined }))).toThrow();
  });
  it("does not confuse the default mock UUID with a verified canonical user when headers are absent", () => {
    expect(verifiedSectionHActor(request({
      user: { userUuid: "default-mock-id" }, headers: {}, rbac: { source: "none", role: null, userType: null },
    })).userId).toBe(id);
  });
  it("rejects forged roles, type and canonical identity", () => {
    for (const verifiedUser of [
      { userId: id, role: "Other", userType: "Office", missing: [] },
      { userId: "different", role: "Editor", userType: "Office", missing: [] },
      { userId: id, role: "Editor", userType: "Ship", missing: [] },
      { userId: id, role: "Editor", userType: null, missing: ["userType"] },
    ]) expect(() => verifiedSectionHActor(request({ verifiedUser }))).toThrow();
  });
  it("never gives Ship an edit bypass", async () => {
    expect(await sectionHCanEdit({ userId: id, role: "Sail Admin", userType: "Ship", canEdit: false })).toBe(false);
  });
  it("accepts every verified Office role regardless of Component edit permission", async () => {
    mocks.getRoleByName.mockResolvedValue({ ruid: "r" });
    mocks.getRoleMenuPermissions.mockResolvedValue([{ menuMuid: "m", canEdit: true }]);
    mocks.getActiveMenuItems.mockResolvedValue([{ muid: "m", name: "pms-components" }]);
    expect(await sectionHCanEdit(verifiedSectionHActor(request()))).toBe(true);
    mocks.getRoleMenuPermissions.mockResolvedValue([{ menuMuid: "m", canEdit: false }]);
    expect(await sectionHCanEdit(verifiedSectionHActor(request()))).toBe(true);
    expect(mocks.getRoleByName).not.toHaveBeenCalled();
  });
  it("does not depend on role configuration or the unrelated menu-permission service", async () => {
    mocks.getRoleByName.mockResolvedValue(null);
    expect(await sectionHCanEdit(verifiedSectionHActor(request()))).toBe(true);
    mocks.getRoleByName.mockRejectedValue(new Error("offline"));
    expect(await sectionHCanEdit(verifiedSectionHActor(request()))).toBe(true);
    expect(mocks.getRoleByName).not.toHaveBeenCalled();
  });
  it("refuses development and unresolved actors even when their profile says Office", async () => {
    const actor = verifiedSectionHActor(request());
    expect(await sectionHCanEdit({ ...actor, identityMode: "development-readonly", canEdit: true })).toBe(false);
    expect(await sectionHCanEdit({ ...actor, identityMode: undefined, canEdit: true })).toBe(false);
  });
});

describe("Section H safe business/date contract", () => {
  it.each(["2024-02-29", "29-02-2024", "29-Feb-2024", "2026-10-30T00:00:00.000Z"])("parses supported day %s", value => {
    expect(classSurveyDay(value)).toBeTruthy();
  });
  it.each(["2025-02-29", "31-04-2026", "2026-13-01", "not a date", "2026-02-30"])("rejects impossible %s", value => {
    expect(classSurveyDay(value)).toBeNull();
  });
  it("allows blank/equal dates but rejects reverse ordering", () => {
    expect(validateClassRegulatoryDates({})).toEqual({});
    expect(validateClassRegulatoryDates({ lastClassSurvey: "2026-01-01", nextSurveyDue: "01-01-2026" })).toEqual({});
    expect(validateClassRegulatoryDates({ lastClassSurvey: "2026-02-01", nextSurveyDue: "2026-01-01" })).toHaveProperty("nextSurveyDue");
  });
  it("preserves invalid unchanged legacy dates, not newly supplied invalid dates", () => {
    expect(validateClassRegulatoryDates({ lastClassSurvey: "legacy bad" }, { lastClassSurvey: "legacy bad" })).toEqual({});
    expect(validateClassRegulatoryDates({ lastClassSurvey: "legacy bad" })).toHaveProperty("lastClassSurvey");
  });
  it("trims texts, preserves date representation and enforces exact limits", () => {
    expect(classRegulatoryInput.parse({ certificateNumber: " A ", lastClassSurvey: "20-Dec-2015" }))
      .toEqual({ certificateNumber: "A", lastClassSurvey: "20-Dec-2015" });
    for (const input of [{ certificateNumber: "a".repeat(101) }, { information: "a".repeat(2001) }, { classRequirements: "a".repeat(2001) }]) {
      expect(classRegulatoryInput.safeParse(input).success).toBe(false);
    }
    expect(classRegulatoryInput.safeParse({ certificateNumber: "a".repeat(100), information: "a".repeat(2000) }).success).toBe(true);
  });
  it("rejects identity/ownership/audit/derived-code overrides", () => {
    for (const key of ["ccruuid", "componentId", "vesselCode", "createdByUuid", "isDeleted", "classCode"]) {
      expect(classRegulatoryInput.safeParse({ [key]: "override" }).success).toBe(false);
    }
  });
  it("keeps shore-owned UUID transport distinct from field logs", () => {
    expect(getTableSyncConfig("component_class_regulatory")).toMatchObject({ identityColumn: "ccruuid", category: "ONE_WAY_SHORE_TO_SHIP" });
    expect(requiresFieldLogging("component_class_regulatory")).toBe(false);
  });
});

describe("reviewed identity mapping", () => {
  const row = { id: 4, component_id: "c1", vessel_code: "V1", certificate_number: "A", ccruuid: null };
  const mapped = () => ({ localId: 4, componentId: "c1", vesselCode: "V1", ccruuid: id, expectedSnapshotSha256: regulatorySnapshotHash(row) });
  it("validates exact target snapshot and is repeatable", () => {
    expect(validateIdentityMap([mapped()], [row])).toHaveLength(1);
    expect(validateIdentityMap([mapped()], [{ ...row, ccruuid: id }])).toHaveLength(1);
  });
  it("refuses changed snapshots, reparenting and duplicate identities", () => {
    expect(() => validateIdentityMap([mapped()], [{ ...row, certificate_number: "changed" }])).toThrow();
    expect(() => validateIdentityMap([{ ...mapped(), vesselCode: "V2" }], [row])).toThrow();
    expect(() => validateIdentityMap([mapped(), mapped()], [row])).toThrow();
    expect(() => validateIdentityMap([mapped()], [row, { ...row, id: 5, ccruuid: id }])).toThrow();
  });
});
