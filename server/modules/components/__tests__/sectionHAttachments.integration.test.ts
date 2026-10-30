import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { resolvePostgres } from "../../../postgresClient";
import * as attachments from "../services/sectionHAttachmentService";
const fixture = vi.hoisted(() => ({ db: null as any, scope: null as any, bytes: new Map<string, Buffer>() }));
vi.mock("../../../db", () => ({ getDb: async () => fixture.scope?.getStore() || fixture.db }));
vi.mock("../../../storage", () => ({ storage: {} }));
vi.mock("../../sync/syncRole", () => ({ isShipInstance: async () => false, getEffectiveInstanceId: async () => "SHORE-TEST" }));
vi.mock("../services/sectionHAttachmentStorage", () => ({
  sectionHStorageBackend: () => "local",
  writeSectionHFile: async (key: string, data: Buffer) => { fixture.bytes.set(key, data); },
  readSectionHFile: async (key: string) => { if (!fixture.bytes.has(key)) throw Error("missing"); return fixture.bytes.get(key); },
  discardSectionHFile: async (key: string) => { fixture.bytes.delete(key); },
  sectionHFileAvailable: async (key: string) => fixture.bytes.has(key),
}));
const component = "8eb5b00d-55cb-4c0f-8b62-000000000291";
const vessel = "8eb5b00d-55cb-4c0f-8b62-000000000292";
const entry = "8eb5b00d-55cb-4c0f-8b62-000000000293";
const actor = { userId: "8eb5b00d-55cb-4c0f-8b62-000000000294", role: "Office Editor", userType: "Office" as const, canEdit: true, identityMode: "verified" as const };
const table = "component_class_regulatory_attachments";
const tables = ["vessels", "components", "component_class_regulatory", "audit_log", "sync_file_queue", "master_users", "master_user_vessels"];
let conn: any, pool: any, migration: string;
function pdf(bytes = 64) {
  const buffer = Buffer.alloc(bytes, 32);
  buffer.write("%PDF-1.7\n"); buffer.write("%%EOF", bytes - 5);
  return { originalname: "fixture.pdf", mimetype: "application/pdf", size: bytes, buffer } as Express.Multer.File;
}
describe("Section H attachment actual PostgreSQL transactions (session-local fixtures only)", () => {
  beforeAll(async () => {
    const pg = await resolvePostgres();
    if (!pg) throw Error("Development PostgreSQL required.");
    pool = pg.pool; conn = await pool.connect();
    fixture.scope = new AsyncLocalStorage();
    for (const name of tables) {
      await conn.query(`CREATE TEMP TABLE "${name}" (LIKE public."${name}" INCLUDING DEFAULTS INCLUDING IDENTITY ${name === "component_class_regulatory" ? "" : "INCLUDING INDEXES"})`);
    }
    await conn.query("SET search_path TO pg_temp, public");
    await conn.query("CREATE UNIQUE INDEX test_partial_ccruuid ON component_class_regulatory(ccruuid) WHERE ccruuid IS NOT NULL");
    migration = await readFile("migrations/190_component_class_regulatory_attachments.sql", "utf8");
    await conn.query(migration);
    fixture.db = drizzle(conn, { schema });
  }, 30000);
  afterAll(async () => {
    if (conn) { await conn.query("RESET search_path"); await conn.query("DISCARD TEMP"); conn.release(); }
    if (pool) await pool.end();
  });
  beforeEach(async () => {
    await conn.query(`TRUNCATE ${[...tables, table].map(t => `pg_temp."${t}"`).join(",")} RESTART IDENTITY`);
    fixture.bytes.clear();
    await conn.query("INSERT INTO pg_temp.vessels(id,vuuid,code,name) VALUES('TEST-V',$1,'TEST-V','Attachment fixture')", [vessel]);
    await conn.query("INSERT INTO pg_temp.components(id,cuuid,vessel_id,vessel_code,name,component_code) VALUES('fixture',$1,$2,'TEST-V','Fixture component','601.001')", [component, vessel]);
    await conn.query("INSERT INTO pg_temp.master_users(id,full_name,user_type) VALUES($1,'Fixture Office','Office')", [actor.userId]);
    await conn.query(`INSERT INTO pg_temp.component_class_regulatory
      (id,ccruuid,component_id,component_code,vessel_code,classification_society,survey_type,created_by)
      VALUES(1,$1,$2,'601.001','TEST-V','DNV','Annual','Fixture Office')`, [entry, component]);
  });
  it("reruns migration 190 with an existing partial UUID index without rewriting identities", async () => {
    await conn.query(migration);
    expect((await conn.query("SELECT ccruuid FROM pg_temp.component_class_regulatory")).rows[0].ccruuid).toBe(entry);
  });
  it("persists the canonical owner, audit and durable queue atomically, retrying without duplicates", async () => {
    const uuid = randomUUID();
    await attachments.upload(entry, uuid, pdf(), actor);
    await attachments.upload(entry, uuid, pdf(), actor);
    const rows = await conn.query(`SELECT * FROM pg_temp.${table}`);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ ccrauuid: uuid, class_regulatory_uuid: entry, vessel_id: vessel, component_id: component, uploaded_by_uuid: actor.userId });
    expect((await conn.query("SELECT * FROM pg_temp.sync_file_queue")).rows).toHaveLength(1);
    expect((await conn.query("SELECT action_type FROM pg_temp.audit_log")).rows.map((r: any) => r.action_type)).toEqual(["create"]);
    expect(fixture.bytes.size).toBe(1);
  });
  it("soft-removes and restores the same retained bytes/identity, with an audit trail", async () => {
    const uuid = randomUUID();
    await attachments.upload(entry, uuid, pdf(), actor);
    await attachments.mutate(entry, uuid, false, actor);
    expect((await attachments.list(entry, actor, false)).activeCount).toBe(0);
    expect((await attachments.list(entry, actor, true)).files[0].isDeleted).toBe(true);
    await expect(attachments.download(entry, uuid, actor)).rejects.toMatchObject({ statusCode: 404 });
    await attachments.mutate(entry, uuid, true, actor);
    expect((await attachments.download(entry, uuid, actor)).bytes.length).toBe(64);
    expect(fixture.bytes.size).toBe(1);
    expect((await conn.query("SELECT action_type FROM pg_temp.audit_log ORDER BY id")).rows.map((r: any) => r.action_type)).toEqual(["create", "delete", "restore"]);
  });
  it("enforces five active files and restore quotas under the parent row lock", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) { ids.push(randomUUID()); await attachments.upload(entry, ids[i], pdf(), actor); }
    await expect(attachments.upload(entry, randomUUID(), pdf(), actor)).rejects.toMatchObject({ statusCode: 409 });
    await attachments.mutate(entry, ids[0], false, actor);
    await attachments.upload(entry, randomUUID(), pdf(), actor);
    await expect(attachments.mutate(entry, ids[0], true, actor)).rejects.toMatchObject({ statusCode: 409 });
    expect((await attachments.list(entry, actor, false)).activeCount).toBe(5);
  });
  it("enforces the 25 MiB combined quota and accepts exact 10 MiB files", async () => {
    await attachments.upload(entry, randomUUID(), pdf(10 * 1024 * 1024), actor);
    await attachments.upload(entry, randomUUID(), pdf(10 * 1024 * 1024), actor);
    await attachments.upload(entry, randomUUID(), pdf(5 * 1024 * 1024), actor);
    await expect(attachments.upload(entry, randomUUID(), pdf(), actor)).rejects.toMatchObject({ statusCode: 409 });
    expect((await attachments.list(entry, actor, false)).activeBytes).toBe(25 * 1024 * 1024);
  });
  it("serializes two simultaneous uploads on independent PostgreSQL connections at the fifth-file boundary", async () => {
    const namespace = `test_section_h_${randomUUID().replace(/-/g, "")}`;
    const first = await pool.connect(), second = await pool.connect();
    try {
      // This unique scratch namespace is shared ONLY by these two test sessions.
      await first.query(`CREATE SCHEMA "${namespace}"`);
      await first.query(`SET search_path TO "${namespace}", public`);
      for (const name of tables) await first.query(`CREATE TABLE "${namespace}"."${name}" (LIKE public."${name}" INCLUDING DEFAULTS INCLUDING IDENTITY INCLUDING INDEXES)`);
      await first.query(migration);
      await first.query("INSERT INTO vessels(id,vuuid,code,name) VALUES('TEST-V',$1,'TEST-V','Fixture')", [vessel]);
      await first.query("INSERT INTO components(id,cuuid,vessel_id,vessel_code,name,component_code) VALUES('fixture',$1,$2,'TEST-V','Fixture','601.001')", [component, vessel]);
      await first.query("INSERT INTO master_users(id,full_name,user_type) VALUES($1,'Fixture Office','Office')", [actor.userId]);
      await first.query(`INSERT INTO component_class_regulatory(id,ccruuid,component_id,component_code,vessel_code,classification_society,survey_type,created_by)
        VALUES(1,$1,$2,'601.001','TEST-V','DNV','Annual','Fixture')`, [entry, component]);
      await second.query(`SET search_path TO "${namespace}", public`);
      const db1 = drizzle(first, { schema }), db2 = drizzle(second, { schema });
      for (let i = 0; i < 4; i++) await fixture.scope.run(db1, () => attachments.upload(entry, randomUUID(), pdf(), actor));
      const results = await Promise.allSettled([
        fixture.scope.run(db1, () => attachments.upload(entry, randomUUID(), pdf(), actor)),
        fixture.scope.run(db2, () => attachments.upload(entry, randomUUID(), pdf(), actor)),
      ]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
      expect((await first.query(`SELECT count(*)::int n FROM ${table} WHERE NOT is_deleted`)).rows[0].n).toBe(5);
    } finally {
      await first.query("RESET search_path"); await second.query("RESET search_path");
      await first.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
      first.release(); second.release();
    }
  });
  it.each(["audit_log", "sync_file_queue"])("rolls back metadata and staged bytes when required %s refuses a write", async target => {
    await conn.query(`ALTER TABLE pg_temp.${target} ADD CONSTRAINT fixture_refusal CHECK (false) NOT VALID`);
    try {
      await expect(attachments.upload(entry, randomUUID(), pdf(), actor)).rejects.toThrow();
      expect((await conn.query(`SELECT count(*)::int n FROM pg_temp.${table}`)).rows[0].n).toBe(0);
      expect(fixture.bytes.size).toBe(0);
    } finally { await conn.query(`ALTER TABLE pg_temp.${target} DROP CONSTRAINT fixture_refusal`); }
  });
  it("refuses Ship writes, unassigned Ship reads and cross-entry file URLs", async () => {
    const uuid = randomUUID(); await attachments.upload(entry, uuid, pdf(), actor);
    const ship = { ...actor, userType: "Ship" as const };
    await expect(attachments.upload(entry, randomUUID(), pdf(), ship)).rejects.toMatchObject({ statusCode: 403 });
    await expect(attachments.list(entry, ship, false)).rejects.toMatchObject({ statusCode: 403 });
    await conn.query("INSERT INTO pg_temp.master_user_vessels(user_uuid,vessel_id) VALUES($1,$2)", [actor.userId, vessel]);
    expect((await attachments.list(entry, ship, false)).activeCount).toBe(1);
    await expect(attachments.list(entry, ship, true)).rejects.toMatchObject({ statusCode: 403 });
    await expect(attachments.download(randomUUID(), uuid, actor)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("blocks removed parents/components without deleting retained attachment rows", async () => {
    const uuid = randomUUID(); await attachments.upload(entry, uuid, pdf(), actor);
    await conn.query("UPDATE pg_temp.component_class_regulatory SET is_deleted=true");
    await expect(attachments.download(entry, uuid, actor)).rejects.toMatchObject({ statusCode: 404 });
    await expect(attachments.upload(entry, randomUUID(), pdf(), actor)).rejects.toMatchObject({ statusCode: 404 });
    await conn.query("UPDATE pg_temp.component_class_regulatory SET is_deleted=false");
    await conn.query("UPDATE pg_temp.components SET is_deleted=true");
    await expect(attachments.download(entry, uuid, actor)).rejects.toMatchObject({ statusCode: 404 });
    expect((await conn.query(`SELECT count(*)::int n FROM pg_temp.${table}`)).rows[0].n).toBe(1);
  });
});
