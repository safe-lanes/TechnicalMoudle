import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({
  pending: [] as any[], transfer: vi.fn(), status: vi.fn(), query: vi.fn(async () => ({ rows: [] as any[] })),
  apply: vi.fn(), columns: new Set<string>(),
}));
vi.mock("../../../db", () => ({ getPool: async () => ({ query: mocks.query }) }));
vi.mock("../repository", () => ({
  getPendingFiles: async () => mocks.pending,
  getFileQueueEntry: async (id: string) => mocks.pending.find(f => f.queueUuid === id),
  getPendingFileCountBySize: async () => mocks.pending.length,
  updateFileStatus: mocks.status,
  setSetting: vi.fn(async () => {}), getSetting: vi.fn(async () => null),
}));
vi.mock("../sectionHAttachmentFiles", () => ({
  SECTION_H_ATTACHMENT_TABLE: "component_class_regulatory_attachments",
  sectionHTransferPath: mocks.transfer, sectionHTransferOwner: vi.fn(),
}));
vi.mock("../oneWayApplier", () => ({
  applyOneWayRows: mocks.apply,
  getColumnMeta: async () => ({ allCols: mocks.columns }),
  coerceArrayValue: (v: unknown) => v,
}));
vi.mock("../syncEngine", () => ({ SYNC_REQUEST_TIMEOUT_FLOOR_MS: 60000 }));
vi.mock("../../../utils/tenantConnectionManager", () => ({ tenantConnectionManager: { isMultiTenantEnabled: false } }));
import { FileSyncProcessor } from "../fileSyncProcessor";
import { importProvisioningBundle } from "../provisioningService";
import { ATTACHMENT_COLUMNS } from "../sectionHAttachmentSync";
const table = "component_class_regulatory_attachments", vessel = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  mocks.pending = []; mocks.status.mockReset(); mocks.transfer.mockReset(); mocks.query.mockClear();
  mocks.apply.mockReset().mockResolvedValue({ inserted: 1, updated: 0, softDeleted: 0, silentNoOps: 0, errors: [] });
  mocks.columns = new Set(ATTACHMENT_COLUMNS);
});
describe("Section H source failures are isolated from the vessel's other documents", () => {
  it.each(["missing source", "object storage unavailable", "file size mismatch"])("keeps %s pending while returning a different document", async reason => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "section-h-list-"));
    const good = path.join(dir, "other.pdf"); await fs.writeFile(good, "%PDF-1.7\n%%EOF");
    try {
      mocks.pending = [
        { queueUuid: "bad-fixture", tableName: table, fileKey: "bad", vesselId: vessel, fileSizeBytes: 10 },
        { queueUuid: "good-fixture", tableName: "work_order_documents", fileKey: good, vesselId: vessel, fileSizeBytes: 14, totalChunks: 1, fileHash: "a".repeat(64) },
      ];
      mocks.transfer.mockRejectedValue(new Error(reason));
      const result = await new FileSyncProcessor().listPendingForPull(vessel, 10485760, ["section_h_attachments_v1"]);
      expect(result.files.map(f => f.queueUuid)).toEqual(["good-fixture"]);
      expect(mocks.status).toHaveBeenCalledWith("bad-fixture", "pending", undefined, expect.stringContaining("repair storage"));
      expect(result.remainingSmallCount).toBe(2);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });
});
describe("Unchanged document source paths", () => {
  it.each([
    ["work_order_documents", "wo-docs"],
    ["component_documents", "component-docs"],
    ["job_work_instruction_files", "job-docs"],
  ])("lists and reads %s without a Defects capability", async (tableName, folder) => {
    const name = `m4-source-${randomUUID()}`, dir = path.resolve(".private", folder, name);
    const bytes = Buffer.from("%PDF-1.4\nunchanged document transport\n%%EOF\n");
    await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, "source.pdf"), bytes);
    try {
      mocks.pending = [{ queueUuid: name, tableName, fileKey: `local://${name}/source.pdf`,
        vesselId: vessel, fileSizeBytes: bytes.length, totalChunks: 1,
        fileHash: createHash("sha256").update(bytes).digest("hex") }];
      const processor = new FileSyncProcessor();
      mocks.query.mockResolvedValueOnce({ rows: [{ n: 0 }] });
      expect((await processor.listPendingForPull(vessel, 10485760, [])).files.map(f => f.queueUuid)).toEqual([name]);
      const chunk = await processor.readChunkForPull(name, 0);
      expect(Buffer.from(chunk!.data, "base64")).toEqual(bytes);
      expect(mocks.status).not.toHaveBeenCalled();
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });
});

describe("Actual provisioning import routes attachment rows through authoritative validation", () => {
  const row = { ccrauuid: "33333333-3333-4333-8333-333333333333", vessel_id: vessel, file_key: "fixture", storage_backend: "object" };
  function bundle() {
    return { manifest: { vesselId: vessel, vesselName: "Fixture", vesselCode: "FIXTURE", generatedAt: new Date().toISOString(), generatedBy: "fixture", instanceId: "SHORE", tables: [], totalRows: 1, version: "1.0", requiredCapabilities: ["section_h_attachments_v1"] },
      data: [{ tableName: table, rows: [row] }] };
  }
  it("uses the same scoped attachment applier as normal sync, not the generic upsert", async () => {
    await importProvisioningBundle(bundle() as any);
    expect(mocks.apply).toHaveBeenCalledWith(table, [row], vessel);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).startsWith(`INSERT INTO "${table}"`))).toBe(false);
  });
  it("records rejection from the authoritative applier and never falls back to generic upsert", async () => {
    mocks.apply.mockRejectedValue(new Error("Section H attachment identity/content cannot be replaced."));
    const result = await importProvisioningBundle(bundle() as any);
    expect(result.errors.join(" ")).toContain("cannot be replaced");
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).startsWith(`INSERT INTO "${table}"`))).toBe(false);
  });
});
