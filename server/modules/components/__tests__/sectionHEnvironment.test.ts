import { describe, expect, it, vi, afterEach } from "vitest";
import { createDefaultDevelopmentUser, selectSectionHUser } from "@shared/developmentUser";
import { sectionHOfficeCanManage } from "../services/classRegulatoryAccess";

vi.mock("../../../db", () => ({ getDb: vi.fn() }));
vi.mock("../../../storage", () => ({ storage: {} }));
vi.mock("../../../utils/tenantConnectionManager", () => ({
  tenantConnectionManager: { isMultiTenantEnabled: false },
}));

const defaultUser = createDefaultDevelopmentUser();
const savedProfile = { ...defaultUser, userUuid: "stored-user", role: "Accounts Officer" as any, userType: "Ship" as const };
afterEach(() => vi.unstubAllEnvs());

describe("Section H environment selection (not global authentication)", () => {
  it("prefers the default user over a stale saved profile only in Replit", () => {
    expect(selectSectionHUser("replit", savedProfile, defaultUser, false)).toBe(defaultUser);
  });
  it.each([undefined, "", "production", "Replit"])("uses the hydrated stored profile for %s", env => {
    expect(selectSectionHUser(env, savedProfile, defaultUser, false)).toBe(savedProfile);
    expect(selectSectionHUser(env, null, defaultUser, false)).toBeNull();
  });
  it("preserves explicit logout and waits for AuthContext hydration", () => {
    expect(selectSectionHUser("replit", savedProfile, defaultUser, true)).toBeNull();
    expect(selectSectionHUser("replit", null, defaultUser, false)).toBeNull();
  });
  it("service-layer entitlement rechecks the server environment and canonical default identity", () => {
    const actor = { userId: defaultUser.userUuid!, role: defaultUser.role, userType: "Office" as const,
      canEdit: false, identityMode: "replit-default" as const };
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VITE_APP_ENV", "replit");
    expect(sectionHOfficeCanManage(actor)).toBe(true);
    expect(sectionHOfficeCanManage({ ...actor, userId: "forged" })).toBe(false);
    expect(sectionHOfficeCanManage({ ...actor, userType: "Ship" })).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    expect(sectionHOfficeCanManage(actor)).toBe(false);
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VITE_APP_ENV", "");
    expect(sectionHOfficeCanManage(actor)).toBe(false);
  });
});
