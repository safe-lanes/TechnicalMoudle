import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDevelopmentUser } from "@shared/developmentUser";

const fake = vi.hoisted(() => ({
  multiTenant: false,
  findMasterUserById: vi.fn(),
  getRoleByName: vi.fn(),
  getActiveMenuItems: vi.fn(),
  getRoleMenuPermissions: vi.fn(),
  isShipInstance: vi.fn(),
  getEffectiveInstanceId: vi.fn(),
}));

vi.mock("../../../utils/tenantConnectionManager", () => ({
  tenantConnectionManager: { get isMultiTenantEnabled() { return fake.multiTenant; } },
}));
vi.mock("../../assistant-api/masterUserRepository", () => ({
  findMasterUserById: fake.findMasterUserById,
}));
vi.mock("../../../storage", () => ({
  storage: {
    getRoleByName: fake.getRoleByName,
    getActiveMenuItems: fake.getActiveMenuItems,
    getRoleMenuPermissions: fake.getRoleMenuPermissions,
  },
}));
vi.mock("../../sync/syncRole", () => ({
  isShipInstance: fake.isShipInstance,
  getEffectiveInstanceId: fake.getEffectiveInstanceId,
}));
vi.mock("../repositories/formsMasterRepository", () => ({
  catalogueError(message: string, statusCode = 409): never {
    throw Object.assign(new Error(message), { statusCode });
  },
}));

import {
  catalogueCapabilities,
  formsMasterReplitDefaultEnabled,
  requireCatalogueIdentity,
  requireCatalogueWrite,
} from "../services/formsMasterService";

const defaultUser = createDefaultDevelopmentUser();
const otherId = "8eb5b00d-55cb-4c0f-8b62-000000000177";

function makeRequest(options: {
  userId?: string;
  role?: string;
  userType?: "Office" | "Ship";
  marker?: string;
  authorization?: string;
  rbacSource?: "forwarded" | "mock" | "none";
  verifiedUser?: { userId: string | null; role: string | null; userType: "Office" | "Ship" | null; missing?: string[] };
} = {}) {
  const userId = options.userId ?? defaultUser.userUuid!;
  const role = options.role ?? defaultUser.role;
  const userType = options.userType ?? "Office";
  const headers: Record<string, string> = {
    "x-user-id": encodeURIComponent(userId),
    "x-user-role": encodeURIComponent(role),
    "x-user-type": encodeURIComponent(userType),
  };
  if (options.marker) headers["x-forms-master-development"] = options.marker;
  if (options.authorization) headers.authorization = options.authorization;
  const req: any = {
    headers,
    user: { userUuid: userId, role: "Sail Admin", userType },
    rbac: { source: options.rbacSource ?? "mock", role: "Sail Admin", userType: "Office" },
    get(name: string) { return headers[name.toLowerCase()]; },
  };
  if (options.verifiedUser) req.verifiedUser = options.verifiedUser;
  if (options.rbacSource === "forwarded") req.rbac = { source: "forwarded", role, userType };
  if (options.rbacSource === "none") req.rbac = { source: "none", role: null, userType: null };
  return req;
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VITE_APP_ENV", "replit");
  fake.multiTenant = false;
  fake.findMasterUserById.mockReset().mockResolvedValue({ role: defaultUser.role, userType: defaultUser.userType });
  fake.getRoleByName.mockReset().mockResolvedValue({ ruid: "role-uuid", isActive: true, isDeleted: false });
  fake.getActiveMenuItems.mockReset().mockResolvedValue([{ name: "admin-masters", muid: "menu-uuid", isDeleted: false }]);
  fake.getRoleMenuPermissions.mockReset().mockResolvedValue([{
    menuMuid: "menu-uuid", canCreate: true, canEdit: true, canDelete: true, isDeleted: false,
  }]);
  fake.isShipInstance.mockReset().mockResolvedValue(false);
  fake.getEffectiveInstanceId.mockReset().mockResolvedValue("SHORE-DEV");
});

afterEach(() => vi.unstubAllEnvs());

describe("Forms Master Replit default identity", () => {
  it("enables the server-only default-user gate only for Replit development single-tenant", () => {
    expect(formsMasterReplitDefaultEnabled()).toBe(true);
    vi.stubEnv("VITE_APP_ENV", "Replit");
    expect(formsMasterReplitDefaultEnabled()).toBe(false);
    vi.stubEnv("VITE_APP_ENV", "replit");
    vi.stubEnv("NODE_ENV", "production");
    expect(formsMasterReplitDefaultEnabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    fake.multiTenant = true;
    expect(formsMasterReplitDefaultEnabled()).toBe(false);
  });

  it("accepts the fixed AuthContext default only after canonical mapping and rewrites route-local RBAC", async () => {
    const req = makeRequest({ marker: "default-user", rbacSource: "mock" });
    await expect(requireCatalogueIdentity(req)).resolves.toBe(defaultUser.userUuid);
    expect(fake.findMasterUserById).toHaveBeenCalledWith(defaultUser.userUuid);
    expect(req.rbac).toEqual({ source: "forwarded", role: defaultUser.role, userType: "Office" });
  });

  it("uses the canonical directory role instead of elevating to the AuthContext label", async () => {
    fake.findMasterUserById.mockResolvedValueOnce({ role: "User", userType: "Office" });
    const req = makeRequest({ marker: "default-user" });
    await expect(requireCatalogueIdentity(req)).resolves.toBe(defaultUser.userUuid);
    expect(req.rbac).toEqual({ source: "forwarded", role: "User", userType: "Office" });
  });

  it("denies missing identity, wrong forwarded identity, and unmapped default users", async () => {
    await expect(requireCatalogueIdentity(makeRequest())).rejects.toMatchObject({ statusCode: 401 });

    const mismatch = makeRequest({ marker: "default-user", role: "PMS Admin", rbacSource: "forwarded" });
    await expect(requireCatalogueIdentity(mismatch)).rejects.toMatchObject({ statusCode: 403 });

    fake.findMasterUserById.mockResolvedValueOnce(null);
    await expect(requireCatalogueIdentity(makeRequest({ marker: "default-user" }))).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([undefined, "", "production", "Replit"])("does not use the default identity when VITE_APP_ENV is %s", async env => {
    vi.stubEnv("VITE_APP_ENV", env as string);
    await expect(requireCatalogueIdentity(makeRequest({ marker: "default-user" }))).rejects.toMatchObject({ statusCode: 401 });
    expect(fake.findMasterUserById).not.toHaveBeenCalled();
  });

  it("does not use the default identity in multi-tenant mode or when a bearer session is present", async () => {
    fake.multiTenant = true;
    await expect(requireCatalogueIdentity(makeRequest({ marker: "default-user" }))).rejects.toMatchObject({ statusCode: 401 });
    expect(fake.findMasterUserById).not.toHaveBeenCalled();

    fake.multiTenant = false;
    await expect(requireCatalogueIdentity(makeRequest({
      marker: "default-user",
      authorization: "Bearer stale-session",
    }))).rejects.toMatchObject({ statusCode: 401 });
    expect(fake.findMasterUserById).not.toHaveBeenCalled();
  });

  it("uses verified identity outside Replit and ignores a default-user marker", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITE_APP_ENV", "");
    const req = makeRequest({
      userId: otherId,
      role: "Fleet Manager",
      userType: "Office",
      marker: "default-user",
      rbacSource: "forwarded",
      verifiedUser: { userId: otherId, role: "Fleet Manager", userType: "Office" },
    });
    await expect(requireCatalogueIdentity(req)).resolves.toBe(otherId);
    expect(fake.findMasterUserById).not.toHaveBeenCalled();
  });

  it("prefers a valid verified session over the default marker", async () => {
    const req = makeRequest({
      marker: "default-user",
      verifiedUser: { userId: defaultUser.userUuid!, role: defaultUser.role, userType: "Office" },
      rbacSource: "forwarded",
    });
    await expect(requireCatalogueIdentity(req)).resolves.toBe(defaultUser.userUuid);
    expect(fake.findMasterUserById).not.toHaveBeenCalled();
  });

  it("derives Forms Master RBAC from the verified session even when global mock RBAC is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITE_APP_ENV", "");
    const req = makeRequest({
      userId: otherId,
      role: "Fleet Manager",
      userType: "Office",
      rbacSource: "mock",
      verifiedUser: { userId: otherId, role: "Fleet Manager", userType: "Office" },
    });
    await expect(requireCatalogueIdentity(req)).resolves.toBe(otherId);
    expect(req.rbac).toEqual({ source: "forwarded", role: "Fleet Manager", userType: "Office" });
  });

  it("keeps Replit default writes subject to ordinary admin-masters grants", async () => {
    const req = makeRequest({ marker: "default-user" });
    await expect(requireCatalogueWrite(req, "create")).resolves.toBe(defaultUser.userUuid);

    fake.getRoleMenuPermissions.mockResolvedValueOnce([{
      menuMuid: "menu-uuid", canCreate: false, canEdit: false, canDelete: false, isDeleted: false,
    }]);
    const denied = makeRequest({ marker: "default-user" });
    await expect(requireCatalogueWrite(denied, "create")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows verified Office users and keeps verified Ship users read-only", async () => {
    const req = makeRequest({
      userId: otherId, role: "Fleet Manager", userType: "Office", rbacSource: "forwarded",
      verifiedUser: { userId: otherId, role: "Fleet Manager", userType: "Office" },
    });
    await expect(catalogueCapabilities(req)).resolves.toEqual({ create: true, edit: true, delete: true });

    const shipReq = makeRequest({
      userId: otherId, role: "Vessel User", userType: "Ship", rbacSource: "forwarded",
      verifiedUser: { userId: otherId, role: "Vessel User", userType: "Ship" },
    });
    await expect(catalogueCapabilities(shipReq)).resolves.toEqual({ create: false, edit: false, delete: false });
  });
});
