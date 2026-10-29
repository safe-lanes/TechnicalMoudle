import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";

const service = vi.hoisted(() => ({
  createClassEntry: vi.fn(), mutateClassEntry: vi.fn(), listClassEntries: vi.fn(), componentClassAccess: vi.fn(),
}));
const permissions = vi.hoisted(() => ({
  getRoleByName: vi.fn(), getRoleMenuPermissions: vi.fn(), getActiveMenuItems: vi.fn(),
}));
const identity = vi.hoisted(() => ({ multiTenant: false, mapped: vi.fn() }));
vi.mock("../../../utils/tenantConnectionManager", () => ({
  tenantConnectionManager: { get isMultiTenantEnabled() { return identity.multiTenant; } },
}));
vi.mock("../../assistant-api/masterUserRepository", () => ({ findMasterUserById: identity.mapped }));
vi.mock("../../../storage", () => ({ storage: permissions }));
vi.mock("../services/classRegulatoryService", () => ({
  ...service, ClassRegulatoryValidationError: class extends Error {},
}));
vi.mock("../controllers/componentController", () => ({
  updateSortOrder: vi.fn(), listByVessel: vi.fn(), getDetails: vi.fn(), listAll: vi.fn(), create: vi.fn(),
  update: vi.fn(), remove: vi.fn(), inactivate: vi.fn(),
}));
vi.mock("../controllers/componentUploadController", () => ({ upload: vi.fn() }));
vi.mock("../controllers/subEntityController", () => ({
  listDocuments: vi.fn(), createDocument: vi.fn(), updateDocument: vi.fn(), deleteDocument: vi.fn(), downloadDocument: vi.fn(),
  listRequisitions: vi.fn(), listAllRequisitions: vi.fn(), getRequisition: vi.fn(), createRequisition: vi.fn(), updateRequisition: vi.fn(), deleteRequisition: vi.fn(),
  listAllMaintenanceHistory: vi.fn(), listVesselMaintenanceHistory: vi.fn(), listMaintenanceHistory: vi.fn(), getMaintenanceHistoryItem: vi.fn(),
  listEquipmentCategories: vi.fn(), createEquipmentCategory: vi.fn(), updateEquipmentCategory: vi.fn(), deleteEquipmentCategory: vi.fn(),
}));
import router from "../routes";

let server: Server, root: string, serverVerified: any, source = "forwarded", loggedIn = true;
const id = "8eb5b00d-55cb-4c0f-8b62-000000000194";
const actions = [["POST", ""], ["PUT", "/1"], ["DELETE", "/1"], ["POST", "/1/restore"]];
const headers = { "content-type": "application/json", "x-user-role": "Editor", "x-user-type": "Office" };

describe("Section H actual route authorization (no production database)", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      // This fixture stands in for already-run authentication middleware.
      if (loggedIn) req.user = { userUuid: id, role: "Sail Admin", vesselId: null };
      req.rbac = { role: req.header("x-user-role"), userType: req.header("x-user-type"), source };
      req.verifiedUser = serverVerified;
      next();
    });
    app.use("/technical/api", router);
    server = await new Promise<Server>(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    root = `http://127.0.0.1:${(server.address() as any).port}/technical/api/component-class-regulatory`;
  });
  afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks(); source = "forwarded"; loggedIn = true;
    identity.multiTenant = false;
    identity.mapped.mockResolvedValue({ role: "Editor", userType: "Office" });
    serverVerified = { userId: id, role: "Editor", userType: "Office", missing: [] };
    permissions.getRoleByName.mockResolvedValue({ ruid: "r" });
    permissions.getActiveMenuItems.mockResolvedValue([{ name: "pms-components", muid: "m" }]);
    permissions.getRoleMenuPermissions.mockResolvedValue([{ menuMuid: "m", canView: true, canEdit: true }]);
    service.createClassEntry.mockResolvedValue({ id: 1 });
    service.mutateClassEntry.mockResolvedValue({ id: 1 });
    service.listClassEntries.mockResolvedValue([]);
    service.componentClassAccess.mockResolvedValue({ canView: true, canEdit: false, identityMode: "verified" });
  });
  afterAll(() => vi.unstubAllEnvs());
  it("refuses every write when only browser headers are supplied", async () => {
    serverVerified = undefined;
    for (const [method, suffix] of actions) {
      const response = await fetch(root + suffix, { method, headers, body: JSON.stringify({ componentId: "c" }) });
      expect(response.status).toBe(403);
    }
    expect(service.createClassEntry).not.toHaveBeenCalled();
    expect(service.mutateClassEntry).not.toHaveBeenCalled();
  });
  it.each(["mock"])("refuses %s even when a trusted-looking verified object exists", async value => {
    source = value;
    expect((await fetch(root, { method: "POST", headers, body: JSON.stringify({ componentId: "c" }) })).status).toBe(403);
  });
  it("accepts verified claims without optional browser identity headers", async () => {
    source = "none";
    expect((await fetch(root + "/component")).status).toBe(200);
    expect((await fetch(root, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ componentId: "c" }) })).status).toBe(201);
    expect(service.createClassEntry.mock.calls[0][2]).toMatchObject({ userId: id, role: "Editor" });
  });
  it("allows every verified Office user even when Component view/edit flags are false", async () => {
    permissions.getRoleMenuPermissions.mockResolvedValue([{ menuMuid: "m", canView: false, canEdit: false }]);
    expect((await fetch(root + "/component", { headers })).status).toBe(200);
    expect((await fetch(root + "/component/access", { headers })).status).toBe(200);
    for (const [method, suffix] of actions) expect((await fetch(root + suffix, {
      method, headers, body: JSON.stringify({ componentId: "c" }),
    })).status).toBe(method === "POST" && suffix === "" ? 201 : 200);
    expect(permissions.getRoleByName).not.toHaveBeenCalled();
  });
  it("returns the explicit refusal when the development control is disabled", async () => {
    serverVerified = undefined; source = "none";
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("PMS_SECTION_H_DEV_READONLY", "false");
    const response = await fetch(root + "/component");
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "SESSION_UNVERIFIED" });
  });
  it("uses only a server-owned read-only development profile and refuses every mutation", async () => {
    serverVerified = undefined; source = "none";
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("PMS_SECTION_H_DEV_READONLY", "true");
    expect((await fetch(root + "/component", { headers: { ...headers, "x-user-id": "forged", "x-user-role": "Sail Admin" } })).status).toBe(200);
    expect(service.listClassEntries.mock.calls[0][1]).toMatchObject({
      userId: "section-h-development-viewer", identityMode: "development-readonly", canEdit: false,
    });
    for (const [method, suffix] of actions) expect((await fetch(root + suffix, {
      method, headers, body: JSON.stringify({ componentId: "c" }),
    })).status).toBe(403);
    expect(service.createClassEntry).not.toHaveBeenCalled();
    expect(service.mutateClassEntry).not.toHaveBeenCalled();
  });
  it.each(["production", "test"])("never enables development reads in %s", async environment => {
    serverVerified = undefined;
    vi.stubEnv("NODE_ENV", environment); vi.stubEnv("PMS_SECTION_H_DEV_READONLY", "true");
    expect((await fetch(root + "/component")).status).toBe(403);
  });
  it("never enables development reads in multitenant mode", async () => {
    serverVerified = undefined; identity.multiTenant = true;
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("PMS_SECTION_H_DEV_READONLY", "true");
    expect((await fetch(root + "/component")).status).toBe(403);
  });
  it("verifies standalone Bearer credentials and looks up the signed canonical user", async () => {
    serverVerified = undefined; source = "none";
    vi.stubEnv("JWT_SECRET", "fixture-only-section-h-signing-key");
    const token = jwt.sign({ id, role: "Editor", userType: "Office" }, "fixture-only-section-h-signing-key", { algorithm: "HS256", expiresIn: "1m" });
    const response = await fetch(root + "/component", { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    expect(identity.mapped).toHaveBeenCalledWith(id);
    expect(service.listClassEntries.mock.calls[0][1]).toMatchObject({ userId: id, role: "Editor", identityMode: "verified" });
  });
  it("uses the established server master lookup for missing signed role claims", async () => {
    serverVerified = { userId: id, role: null, userType: "Office", missing: ["role"] }; source = "none";
    expect((await fetch(root + "/component")).status).toBe(200);
    expect(identity.mapped).toHaveBeenCalledWith(id);
  });
  it("never falls back to development access after invalid, expired or unmapped credentials", async () => {
    serverVerified = undefined; source = "none";
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("PMS_SECTION_H_DEV_READONLY", "true");
    vi.stubEnv("JWT_SECRET", "fixture-only-section-h-signing-key");
    const tokens = [
      ["garbage", "INVALID_SESSION"],
      [jwt.sign({ id, role: "Editor", userType: "Office" }, "fixture-only-section-h-signing-key", { expiresIn: -1 }), "SESSION_EXPIRED"],
    ];
    for (const [token, code] of tokens) {
      const response = await fetch(root + "/component", { headers: { authorization: `Bearer ${token}` } });
      expect(response.status).toBe(401); expect(await response.json()).toMatchObject({ code });
    }
    identity.mapped.mockResolvedValue(null);
    const token = jwt.sign({ id, role: "Editor", userType: "Office" }, "fixture-only-section-h-signing-key");
    expect((await fetch(root + "/component", { headers: { authorization: `Bearer ${token}` } })).status).toBe(403);
    expect(service.listClassEntries).not.toHaveBeenCalled();
  });
  it("refuses conflicting identity and treats lookup outages as infrastructure failures", async () => {
    expect((await fetch(root + "/component", { headers: { ...headers, "x-user-id": "someone-else" } })).status).toBe(403);
    serverVerified = { userId: id, role: null, userType: "Office", missing: ["role"] };
    identity.mapped.mockRejectedValue(new Error("database password must not be exposed"));
    const response = await fetch(root + "/component", { headers });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("password");
  });
  it("returns 401 without an authenticated request user", async () => {
    loggedIn = false;
    expect((await fetch(root, { method: "POST", headers, body: "{}" })).status).toBe(401);
  });
  it("permits all H lifecycle actions for an Office user with Component edit", async () => {
    for (const [method, suffix] of actions) {
      const response = await fetch(root + suffix, { method, headers, body: JSON.stringify({ componentId: "c" }) });
      expect(response.status).toBe(method === "POST" && suffix === "" ? 201 : 200);
    }
    expect(service.createClassEntry.mock.calls[0][2]).toMatchObject({ userId: id, userType: "Office", canEdit: true });
    expect(service.mutateClassEntry).toHaveBeenCalledTimes(3);
  });
  it("refuses a Ship identity even if its role has admin bypass", async () => {
    serverVerified = { userId: id, role: "Sail Admin", userType: "Ship", missing: [] };
    const shipHeaders = { ...headers, "x-user-role": "Sail Admin", "x-user-type": "Ship" };
    expect((await fetch(root + "/component", { headers: shipHeaders })).status).toBe(200);
    for (const [method, suffix] of actions) expect((await fetch(root + suffix, {
      method, headers: shipHeaders, body: "{}",
    })).status).toBe(403);
    expect(service.createClassEntry).not.toHaveBeenCalled();
    expect(service.mutateClassEntry).not.toHaveBeenCalled();
  });
  it.each(["Accounts Officer", "Unconfigured Office"])("allows %s through every lifecycle action without role permission lookups", async role => {
    serverVerified.role = role;
    permissions.getRoleByName.mockRejectedValue(new Error("Unrelated permissions unavailable"));
    const officeHeaders = { ...headers, "x-user-role": role };
    expect((await fetch(root + "/component?includeDeleted=true", { headers: officeHeaders })).status).toBe(200);
    expect(service.listClassEntries).toHaveBeenCalledWith("component", expect.objectContaining({
      role, userType: "Office", identityMode: "verified", canEdit: true,
    }), true);
    for (const [method, suffix] of actions) expect((await fetch(root + suffix, {
      method, headers: officeHeaders, body: JSON.stringify({ componentId: "c" }),
    })).status).toBe(method === "POST" && suffix === "" ? 201 : 200);
    expect(permissions.getRoleByName).not.toHaveBeenCalled();
  });
  it("names unavailable standalone verification rather than falling back to the development viewer", async () => {
    serverVerified = undefined; source = "none";
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("PMS_SECTION_H_DEV_READONLY", "true");
    const response = await fetch(root + "/component", { headers: { Authorization: "Bearer unavailable-session" } });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "IDENTITY_UNAVAILABLE" });
    expect(service.listClassEntries).not.toHaveBeenCalled();
  });
  it("permits unconfigured Office roles but still refuses role-forged callers", async () => {
    permissions.getRoleByName.mockResolvedValue(null);
    expect((await fetch(root + "/1/restore", { method: "POST", headers, body: "{}" })).status).toBe(200);
    service.mutateClassEntry.mockClear();
    expect((await fetch(root + "/1", { method: "DELETE", headers: { ...headers, "x-user-role": "Sail Admin" } })).status).toBe(403);
    expect(service.mutateClassEntry).not.toHaveBeenCalled();
  });
});
