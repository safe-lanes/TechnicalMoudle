import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createInsertSchema } from "drizzle-zod";
import { getTableConfig } from "drizzle-orm/pg-core";
import { admRoleMenuAccess, insertAdmRoleMenuAccessSchema } from "@shared/schema";
import { SYNC_CONFIG, getSyncPhaseOrder } from "@shared/syncConfig";

const database = vi.hoisted(() => ({ getPool: vi.fn() }));
vi.mock("../db", () => ({ getPool: database.getPool }));
vi.mock("../modules/sync/syncDiagLogger", () => ({ syncDiag: vi.fn() }));
import { applyOneWayRows } from "../modules/sync/oneWayApplier";

describe("Access Control insert validator equivalence", () => {
  const raw = createInsertSchema(admRoleMenuAccess);
  // Recreate the old runtime mask without suppressing its invalid compile-time id key.
  const previous = raw.omit({
    ...Object.fromEntries([["id", true]]), createdAt: true, updatedAt: true,
  });
  const references = { roleRuid: "role-ref", menuMuid: "menu-ref" };
  const permissions = { canView: false, canCreate: false, canEdit: false, canDelete: false };

  it("generated identity is already absent and only timestamps need omission", () => {
    expect(Object.keys(raw.shape)).not.toContain("id");
    expect(Object.keys(insertAdmRoleMenuAccessSchema.shape)).toEqual(Object.keys(previous.shape));
    expect(Object.keys(insertAdmRoleMenuAccessSchema.shape).sort()).toEqual([
      "roleRuid", "menuMuid", "canView", "canCreate", "canEdit", "canDelete",
      "createdByUuid", "updatedByUuid", "isDeleted", "isSync", "sortOrder",
    ].sort());
    expect(getTableConfig(admRoleMenuAccess).columns.find(column => column.name === "id")?.generatedIdentity?.type)
      .toBe("always");
  });

  it.each([
    references,
    { ...references, ...permissions },
    { ...references, canView: true, canEdit: true },
    {
      ...references, ...permissions, id: 99, createdAt: new Date(0), updatedAt: new Date(1),
      createdByUuid: "creator-ref", updatedByUuid: "updater-ref", isSync: true, isDeleted: true, sortOrder: 7,
    },
    { ...references, isSync: false, isDeleted: false, sortOrder: 0 },
    { menuMuid: "menu-ref" },
    { roleRuid: "role-ref" },
  ])("preserves parse results for %j", input => {
    const after = insertAdmRoleMenuAccessSchema.safeParse(input);
    const before = previous.safeParse(input);
    expect(JSON.parse(JSON.stringify(after))).toEqual(JSON.parse(JSON.stringify(before)));
    if (after.success) {
      for (const key of ["id", "createdAt", "updatedAt"]) expect(after.data).not.toHaveProperty(key);
    } else {
      expect(after.error.issues[0].path).toEqual(["roleRuid" in input ? "menuMuid" : "roleRuid"]);
    }
  });

  it("does not invent validator permission defaults; keeps database defaults false", () => {
    expect(insertAdmRoleMenuAccessSchema.parse(references)).toEqual(references);
    expect(insertAdmRoleMenuAccessSchema.parse({ ...references, ...permissions }))
      .toEqual({ ...references, ...permissions });
    for (const column of ["canView", "canCreate", "canEdit", "canDelete"] as const) {
      expect(admRoleMenuAccess[column].default).toBe(false);
    }
  });
});

describe("role-menu sync guardrails with a mocked pool", () => {
  let exists: boolean;
  let calls: { text: string; values: unknown[] }[];
  const table = "adm_role_menu_access";
  const incoming = {
    id: 902, roleRuid: "role-ref", menuMuid: "menu-ref",
    canView: false, canCreate: true, canEdit: false, canDelete: false,
    createdByUuid: "creator-ref", updatedByUuid: "updater-ref",
    isSync: true, isDeleted: false, sortOrder: 7,
  };
  beforeEach(() => {
    exists = false;
    calls = [];
    database.getPool.mockResolvedValue({
      query: vi.fn(async (text: string, values: unknown[] = []) => {
        calls.push({ text, values });
        if (text.includes("a.attidentity")) return { rows: [{ attname: "id" }] };
        if (text.includes("nextval(") || text.includes("data_type IN") || text.includes("data_type = 'ARRAY'")) {
          return { rows: [] };
        }
        if (text.includes("information_schema.columns")) {
          return { rows: getTableConfig(admRoleMenuAccess).columns.map(column => ({ column_name: column.name })) };
        }
        if (text.startsWith('SELECT "id"')) return { rows: exists ? [{ id: 41 }] : [] };
        if (/^(INSERT|UPDATE)/.test(text)) return { rows: [], rowCount: 1 };
        if (text.includes("setval(")) return { rows: [] };
        throw new Error(`Unexpected mocked SQL: ${text}`);
      }),
    });
  });

  function lookup() {
    const select = calls.find(call => call.text.startsWith('SELECT "id"'))!;
    expect(select.text).toContain('"role_ruid" = $1 AND "menu_muid" = $2');
    expect(select.values).toEqual(["role-ref", "menu-ref"]);
    expect(select.values).not.toContain(incoming.id);
  }

  it("inserts by natural key, excluding generated id and retaining audit/sync values", async () => {
    const result = await applyOneWayRows(table, [incoming]);
    expect(result).toMatchObject({ inserted: 1, errors: [] });
    lookup();
    const insert = calls.find(call => call.text.startsWith("INSERT"))!;
    expect(insert.text).not.toContain('"id"');
    const columns = [...insert.text.matchAll(/"([^"]+)"/g)].slice(1).map(match => match[1]);
    expect(Object.fromEntries(columns.map((column, index) => [column, insert.values[index]]))).toEqual({
      role_ruid: "role-ref", menu_muid: "menu-ref",
      can_view: false, can_create: true, can_edit: false, can_delete: false,
      created_by_uuid: "creator-ref", updated_by_uuid: "updater-ref",
      is_sync: true, is_deleted: false, sort_order: 7,
    });
  });

  it("updates an existing natural-key row without copying the sender id", async () => {
    exists = true;
    const result = await applyOneWayRows(table, [incoming]);
    expect(result).toMatchObject({ updated: 1, inserted: 0, errors: [] });
    lookup();
    const update = calls.find(call => call.text.startsWith("UPDATE"))!;
    expect(update.text).not.toContain('"id"');
    expect(update.text).toContain('"updated_by_uuid"');
    expect(update.text).toContain('"is_sync"');
    expect(update.values).not.toContain(902);
    expect(update.values.slice(-2)).toEqual(["role-ref", "menu-ref"]);
    expect(update.values).toContain(false);
    expect(update.values).toContain("updater-ref");
    expect(update.text).toContain("updated_at = NOW()");
  });

  it("retains soft-delete behavior instead of deleting rows", async () => {
    exists = true;
    const result = await applyOneWayRows(table, [{ ...incoming, isDeleted: true }]);
    expect(result).toMatchObject({ softDeleted: 1, updated: 0, errors: [] });
    lookup();
    const update = calls.find(call => call.text.startsWith("UPDATE"))!;
    expect(update.text).toContain("SET is_deleted = true, updated_at = NOW()");
    expect(update.values).toEqual(["role-ref", "menu-ref"]);
    expect(calls.some(call => call.text.startsWith("DELETE"))).toBe(false);
  });
});

describe("dormant integrations stay outside startup, migration discovery and provisioning", () => {
  const source = (file: string) => fs.readFileSync(file, "utf8");
  it("keeps chat outside the schema barrel and migration discovery", () => {
    expect(source("shared/schema.ts")).not.toMatch(/models\/chat|export.*\b(conversations|messages)\b/);
    expect(source("drizzle.config.ts")).toContain('schema: "./shared/schema.ts"');
    expect(source("server/db.ts")).toContain('import * as schema from "@shared/schema"');
  });
  it("does not register chat or image routes in either inspected entrypoint", () => {
    for (const file of ["server/index.ts", "server/routes.ts"]) {
      expect(source(file)).not.toMatch(/replit_integrations\/(chat|image)|register(Chat|Image)Routes/);
    }
  });
  it("retains role-menu membership and excludes chat tables from provisioning", () => {
    expect(SYNC_CONFIG.adm_role_menu_access).toMatchObject({
      category: "ONE_WAY_SHORE_TO_SHIP", direction: "shore_to_ship", identityColumn: null,
    });
    expect(SYNC_CONFIG).not.toHaveProperty("conversations");
    expect(SYNC_CONFIG).not.toHaveProperty("messages");
    const provisioningTables = getSyncPhaseOrder().flat();
    expect(provisioningTables).toContain("adm_role_menu_access");
    expect(provisioningTables).not.toContain("conversations");
    expect(provisioningTables).not.toContain("messages");
    const provisioning = source("server/modules/sync/provisioningService.ts");
    expect(provisioning).toContain("getTablesByCategory(");
    expect(provisioning).toContain("getSyncPhaseOrder(");
    expect(source("shared/syncConfig.ts")).toContain("Object.values(SYNC_CONFIG).filter");
  });
  it("preserves the full pre-correction sync membership inventory", () => {
    // Intentional scope snapshot: future approved sync changes must update this inventory.
    const membership = Object.entries(SYNC_CONFIG)
      .map(([name, config]) => [name, config.category, config.direction, config.identityColumn])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    // feature/approval-engine-phase2 adds 12 tables: approval_withdrawals, approval_history (BOTH_EDITABLE),
    // defect_closure_history (ONE_WAY_SHORE_TO_SHIP) and the NO_SYNC apprv_* engine / defect approval settings tables.
    // feature/job-work-instructions (mig 183) adds 2 ONE_WAY_SHORE_TO_SHIP tables: job_work_instruction_files
    // (jwfuuid) and job_work_instruction_links (jwluuid).
    expect(membership).toHaveLength(137);
    expect(createHash("sha256").update(JSON.stringify(membership)).digest("hex"))
      // Updated 23-Oct-2026 for the approved sync fix 43c895faf (component_documents id → cduuid, mig 182) and the
      // approval branch tables above; 25-Oct-2026 for the Work Instructions tables; 26-Oct-2026 defect_sequences
      // BOTH_EDITABLE → NO_SYNC (per-side counter, never travels — see shared/syncConfig.ts notes).
      .toBe("6a95605367b72b5187754e44048688e646fefedd0e1e739c4be5b26b008bcbd0");
  });
  it("leaves Access Control saves mapping flags directly and omitting generated ids", () => {
    const storage = source("server/postgresStorage.ts");
    const save = storage.slice(
      storage.indexOf("  async saveRoleMenuPermissions("),
      storage.indexOf("  async getApprovalWorkflowConfig("),
    );
    expect(save).toContain("tx.insert(admRoleMenuAccess).values(rows)");
    expect(save).not.toMatch(/\bid\s*:|insertAdmRoleMenuAccessSchema/);
    for (const permission of ["canView", "canCreate", "canEdit", "canDelete"]) {
      expect(save).toContain(`${permission}: p.${permission} ?? false`);
    }
  });
});
