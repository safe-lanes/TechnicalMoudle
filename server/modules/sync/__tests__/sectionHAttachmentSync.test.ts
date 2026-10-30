import { describe, it, expect, vi } from "vitest";
import { applySectionHAttachmentRows, validateAttachmentSnapshot, ATTACHMENT_COLUMNS } from "../sectionHAttachmentSync";
import { getTableSyncConfig, getSyncPhaseOrder } from "@shared/syncConfig";
const v = "11111111-1111-4111-8111-111111111111", e = "22222222-2222-4222-8222-222222222222";
const a = "33333333-3333-4333-8333-333333333333", c = "44444444-4444-4444-8444-444444444444";
function snapshot() {
  return { ccrauuid: a, class_regulatory_uuid: e, component_id: c, vessel_id: v,
    original_filename: "survey.pdf", file_key: `${v}/${e}/${a}_survey.pdf`, content_type: "application/pdf",
    file_size: 100, storage_backend: "object", uploaded_by_uuid: c, uploaded_by: "Office fixture",
    uploaded_at: "2026-10-01T00:00:00", created_at: "2026-10-01T00:00:00", updated_at: "2026-10-02T00:00:00",
    created_by: "Office fixture", updated_by: "Office fixture", created_by_uuid: c, updated_by_uuid: c,
    is_deleted: false, deleted_at: null, deleted_by_uuid: null, is_sync: false, sort_order: 0 };
}
function receiver(existing?: object, parent = true) {
  const conn = { query: vi.fn(async (sql: string) => {
    if (sql.includes("SELECT e.ccruuid")) return { rows: parent ? [{ ccruuid: e }] : [] };
    if (sql.includes("SELECT *")) return { rows: existing ? [existing] : [] };
    if (sql.startsWith("UPDATE")) return { rows: [{ ccrauuid: a }] };
    return { rows: [] };
  }), release: vi.fn() };
  return { conn, pool: { connect: vi.fn(async () => conn) } as any };
}
describe("Section H attachment authoritative synchronization", () => {
  it("stays one-way, with parent before attachment metadata and no field log entity", () => {
    expect(getTableSyncConfig("component_class_regulatory_attachments")?.category).toBe("ONE_WAY_SHORE_TO_SHIP");
    const order = getSyncPhaseOrder().flat();
    expect(order.indexOf("component_class_regulatory_attachments")).toBeGreaterThan(order.indexOf("component_class_regulatory"));
  });
  it("requires migration 190 and a complete snapshot", async () => {
    const { pool } = receiver();
    await expect(applySectionHAttachmentRows(pool, [snapshot()], new Set())).rejects.toThrow("migration 190");
    const row: any = snapshot(); delete row.uploaded_by_uuid;
    expect(() => validateAttachmentSnapshot(row)).toThrow("Incomplete");
  });
  it.each(["vessel_id", "component_id", "class_regulatory_uuid"])("refuses mismatched ownership %s", key => {
    const row: any = snapshot(); row[key] = "../bad";
    expect(() => validateAttachmentSnapshot(row)).toThrow();
  });
  it("refuses traversal, file type changes, oversized files and bad lifecycle", () => {
    for (const delta of [{file_key:"../../bad"}, {content_type:"text/html"}, {file_size:10485761}, {is_deleted:true}]) {
      expect(() => validateAttachmentSnapshot({...snapshot(), ...delta})).toThrow();
    }
  });
  it("commits an insert with receiver-local backend and preserves sender timestamps", async () => {
    const { conn, pool } = receiver();
    const result = await applySectionHAttachmentRows(pool, [snapshot()], new Set(ATTACHMENT_COLUMNS));
    expect(result.inserted).toBe(1);
    const insert = conn.query.mock.calls.find(([sql]) => sql.startsWith("INSERT")) as any;
    expect(insert[1][ATTACHMENT_COLUMNS.indexOf("storage_backend")]).toBe("local");
    expect(insert[1][ATTACHMENT_COLUMNS.indexOf("updated_at")]).toBe(snapshot().updated_at);
    expect(conn.query).toHaveBeenCalledWith("COMMIT");
  });
  it("replays by UUID without natural-key insertion", async () => {
    const { conn, pool } = receiver(snapshot());
    expect((await applySectionHAttachmentRows(pool, [snapshot()], new Set(ATTACHMENT_COLUMNS))).updated).toBe(1);
    expect(conn.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
  });
  it("rolls back a missing parent without advancing/partially inserting", async () => {
    const { conn, pool } = receiver(undefined, false);
    await expect(applySectionHAttachmentRows(pool, [snapshot()], new Set(ATTACHMENT_COLUMNS))).rejects.toThrow("dependency");
    expect(conn.query).toHaveBeenCalledWith("ROLLBACK");
  });
  it("refuses in-place replacement of immutable file metadata", async () => {
    const { conn, pool } = receiver({ ...snapshot(), file_size: 200 });
    await expect(applySectionHAttachmentRows(pool, [snapshot()], new Set(ATTACHMENT_COLUMNS))).rejects.toThrow("cannot be replaced");
    expect(conn.query).toHaveBeenCalledWith("ROLLBACK");
  });
});
