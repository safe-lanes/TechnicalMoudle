import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const service = vi.hoisted(() => ({
  createClassEntry: vi.fn(), mutateClassEntry: vi.fn(), listClassEntries: vi.fn(), componentClassAccess: vi.fn(),
}));
const permissions = vi.hoisted(() => ({
  getRoleByName: vi.fn(), getRoleMenuPermissions: vi.fn(), getActiveMenuItems: vi.fn(),
}));
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
    vi.clearAllMocks(); source = "forwarded"; loggedIn = true;
    serverVerified = { userId: id, role: "Editor", userType: "Office", missing: [] };
    permissions.getRoleByName.mockResolvedValue({ ruid: "r" });
    permissions.getActiveMenuItems.mockResolvedValue([{ name: "pms-components", muid: "m" }]);
    permissions.getRoleMenuPermissions.mockResolvedValue([{ menuMuid: "m", canView: true, canEdit: true }]);
    service.createClassEntry.mockResolvedValue({ id: 1 });
    service.mutateClassEntry.mockResolvedValue({ id: 1 });
  });
  it("refuses every write when only browser headers are supplied", async () => {
    serverVerified = undefined;
    for (const [method, suffix] of actions) {
      const response = await fetch(root + suffix, { method, headers, body: JSON.stringify({ componentId: "c" }) });
      expect(response.status).toBe(403);
    }
    expect(service.createClassEntry).not.toHaveBeenCalled();
    expect(service.mutateClassEntry).not.toHaveBeenCalled();
  });
  it.each(["none", "mock"])("refuses %s even when a trusted-looking verified object exists", async value => {
    source = value;
    expect((await fetch(root, { method: "POST", headers, body: JSON.stringify({ componentId: "c" }) })).status).toBe(403);
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
    expect((await fetch(root, { method: "POST", headers: { ...headers, "x-user-role": "Sail Admin", "x-user-type": "Ship" }, body: "{}" })).status).toBe(403);
  });
  it("refuses view-only, unconfigured and role-forged callers", async () => {
    permissions.getRoleMenuPermissions.mockResolvedValue([{ menuMuid: "m", canView: true, canEdit: false }]);
    expect((await fetch(root + "/1", { method: "DELETE", headers })).status).toBe(403);
    permissions.getRoleByName.mockResolvedValue(null);
    expect((await fetch(root + "/1/restore", { method: "POST", headers, body: "{}" })).status).toBe(403);
    expect((await fetch(root + "/1", { method: "DELETE", headers: { ...headers, "x-user-role": "Sail Admin" } })).status).toBe(403);
    expect(service.mutateClassEntry).not.toHaveBeenCalled();
  });
});
