import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { resolvePostgres } from "../../../postgresClient";
import { createClassEntry, mutateClassEntry, listClassEntries, componentClassAccess } from "../services/classRegulatoryService";
import { applyClassRegulatoryRows, CLASS_REGULATORY_REQUIRED_COLUMNS } from "../../sync/classRegulatorySync";

const fixture = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../../db", () => ({ getDb: async () => fixture.db }));
vi.mock("../../../storage", () => ({ storage: {} }));

const component = "8eb5b00d-55cb-4c0f-8b62-000000000191";
const vessel = "8eb5b00d-55cb-4c0f-8b62-000000000192";
const actor = { userId: "8eb5b00d-55cb-4c0f-8b62-000000000193", role: "Editor", userType: "Office" as const, canEdit: true };
const business = { classificationSocietyKey: "DNV", surveyTypeKey: "CLS-ANN", certificateNumber: "TEST", lastClassSurvey: "20-Dec-2015" };
let conn: any, pool: any;
const migrations = [
  "185_component_class_regulatory_identity_lifecycle.sql",
  "186_section_h_master_metadata.sql",
  "187_section_h_master_seed.sql",
];
const tables = ["vessels", "components", "component_class_regulatory", "master_lists", "master_list_types", "audit_log", "master_user_vessels", "sync_settings"];

describe("Section H real PostgreSQL persistence (TEMP tables only)", () => {
  beforeAll(async () => {
    const postgres = await resolvePostgres();
    if (!postgres) throw new Error("Section H integration tests need the development PostgreSQL connection.");
    pool = postgres.pool;
    conn = await pool.connect();
    // Every write is confined to session-local pg_temp tables. Public data is never mutated.
    for (const name of tables) await conn.query(`CREATE TEMP TABLE "${name}" (LIKE public."${name}" INCLUDING ALL)`);
    await conn.query(`ALTER TABLE pg_temp.component_class_regulatory
      DROP COLUMN IF EXISTS ccruuid, DROP COLUMN IF EXISTS deleted_by_uuid, DROP COLUMN IF EXISTS deleted_at,
      DROP COLUMN IF EXISTS classification_society_key, DROP COLUMN IF EXISTS survey_type_key`);
    for (const migration of migrations) await conn.query(await readFile(`migrations/${migration}`, "utf8"));
    fixture.db = drizzle(conn, { schema });
  }, 30_000);
  afterAll(async () => {
    if (conn) { await conn.query("DISCARD TEMP"); conn.release(); }
    if (pool) await pool.end();
  });
  beforeEach(async () => {
    // pg_temp qualifier ensures a fixture failure cannot ever truncate public tables.
    await conn.query(`TRUNCATE ${tables.map(name => `pg_temp."${name}"`).join(", ")} RESTART IDENTITY`);
    for (const migration of migrations) await conn.query(await readFile(`migrations/${migration}`, "utf8"));
    await conn.query("INSERT INTO pg_temp.vessels (id,vuuid,code,name) VALUES ('TEST-V',$1,'TEST-V','Section H Test')", [vessel]);
    await conn.query("INSERT INTO pg_temp.components (id,cuuid,vessel_id,vessel_code,name,component_code) VALUES ('test-component',$1,$2,'TEST-V','Test Component','601.001')", [component, vessel]);
    await conn.query("INSERT INTO pg_temp.sync_settings (setting_key,setting_value) VALUES ('section_h_ready_vessels',$1)", [JSON.stringify([vessel])]);
  });
  it("replays all three SQL files without duplicating or resetting masters", async () => {
    await conn.query("UPDATE pg_temp.master_lists SET list_value = 'Edited DNV', is_active = false WHERE list_type='classificationSociety' AND list_key='DNV'");
    for (const file of migrations) await conn.query(await readFile(`migrations/${file}`, "utf8"));
    const counts = await conn.query("SELECT list_type,count(*)::int AS n FROM pg_temp.master_lists GROUP BY list_type");
    expect(counts.rows).toEqual(expect.arrayContaining([{ list_type: "classificationSociety", n: 19 }, { list_type: "surveyType", n: 46 }]));
    const saved = await conn.query("SELECT list_value,is_active FROM pg_temp.master_lists WHERE list_key='DNV'");
    expect(saved.rows[0]).toEqual({ list_value: "Edited DNV", is_active: false });
  });
  it("persists multiple same-pair entries, edits independently and preserves untouched legacy fields", async () => {
    const first = await createClassEntry(component, business, actor);
    const second = await createClassEntry(component, { ...business, certificateNumber: "OTHER" }, actor);
    expect(first.ccruuid).not.toEqual(second.ccruuid);
    expect(first.classCode).toBe("DNV");
    await conn.query("UPDATE pg_temp.component_class_regulatory SET issue_date='legacy issue', remarks='keep' WHERE id=$1", [first.id]);
    await mutateClassEntry(first.id, { information: " updated " }, "update", actor);
    const saved = await listClassEntries(component, actor);
    expect(saved).toHaveLength(2);
    expect(saved.find(row => row.id === first.id)).toMatchObject({
      information: "updated", lastClassSurvey: "20-Dec-2015", issueDate: "legacy issue", remarks: "keep", ccruuid: first.ccruuid,
    });
    expect(saved.find(row => row.id === second.id)?.certificateNumber).toBe("OTHER");
  });
  it("soft-deletes and restores the original identity with atomic audit history", async () => {
    const first = await createClassEntry(component, business, actor);
    const removed = await mutateClassEntry(first.id, {}, "delete", actor);
    expect(removed).toMatchObject({ isDeleted: true, deletedByUuid: actor.userId, ccruuid: first.ccruuid });
    expect(removed.deletedAt).toBeTruthy();
    expect(await listClassEntries(component, actor)).toHaveLength(0);
    expect(await listClassEntries(component, actor, true)).toHaveLength(1);
    const restored = await mutateClassEntry(first.id, {}, "restore", actor);
    expect(restored).toMatchObject({ id: first.id, ccruuid: first.ccruuid, isDeleted: false, deletedByUuid: null, deletedAt: null });
    await mutateClassEntry(first.id, {}, "restore", actor); // idempotent retry: no extra history
    expect((await conn.query("SELECT action_type FROM pg_temp.audit_log ORDER BY id")).rows.map((row: any) => row.action_type))
      .toEqual(["create", "delete", "restore"]);
  });
  it("rolls back the business insert if required audit fails", async () => {
    await conn.query("ALTER TABLE pg_temp.audit_log ADD CONSTRAINT test_audit_refusal CHECK (action_type <> 'create')");
    try {
      await expect(createClassEntry(component, business, actor)).rejects.toThrow();
      expect((await conn.query("SELECT count(*)::int AS n FROM pg_temp.component_class_regulatory")).rows[0].n).toBe(0);
    } finally {
      await conn.query("ALTER TABLE pg_temp.audit_log DROP CONSTRAINT test_audit_refusal");
    }
  });
  it("rejects invalid masters, scope tampering, dates and unauthorized direct service writes", async () => {
    await expect(createClassEntry(component, { ...business, surveyTypeKey: "DNV" }, actor)).rejects.toMatchObject({ statusCode: 400 });
    await expect(createClassEntry(component, { ...business, lastClassSurvey: "2025-02-29" }, actor)).rejects.toMatchObject({ statusCode: 400 });
    await expect(createClassEntry(component, business, { ...actor, canEdit: false })).rejects.toMatchObject({ statusCode: 403 });
    const row = await createClassEntry(component, business, actor);
    await expect(mutateClassEntry(row.id, { componentId: "other" }, "update", actor)).rejects.toMatchObject({ statusCode: 400 });
    const ship = { ...actor, userType: "Ship" as const };
    await expect(mutateClassEntry(row.id, {}, "delete", ship)).rejects.toMatchObject({ statusCode: 403 });
    await expect(listClassEntries(component, ship)).rejects.toMatchObject({ statusCode: 403 });
    await conn.query("INSERT INTO pg_temp.master_user_vessels (user_uuid,vessel_id) VALUES ($1,$2)", [actor.userId, vessel]);
    expect(await listClassEntries(component, { ...ship, canEdit: false })).toHaveLength(1);
    await conn.query("UPDATE pg_temp.master_user_vessels SET is_active=false");
    await expect(listClassEntries(component, ship)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("keeps legacy invalid dates on unrelated edits but rejects changed invalid dates", async () => {
    const row = await createClassEntry(component, business, actor);
    await conn.query("UPDATE pg_temp.component_class_regulatory SET last_class_survey='bad historical date' WHERE id=$1", [row.id]);
    expect(await mutateClassEntry(row.id, { information: "unrelated" }, "update", actor)).toMatchObject({ lastClassSurvey: "bad historical date" });
    await expect(mutateClassEntry(row.id, { lastClassSurvey: "changed bad date" }, "update", actor)).rejects.toMatchObject({ statusCode: 400 });
  });
  it("safely gates historical NULL identities rather than random-backfilling", async () => {
    const row = await createClassEntry(component, business, actor);
    await conn.query("UPDATE pg_temp.component_class_regulatory SET ccruuid=NULL WHERE id=$1", [row.id]);
    await expect(createClassEntry(component, business, actor)).rejects.toMatchObject({ statusCode: 409 });
    await expect(mutateClassEntry(row.id, {}, "delete", actor)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("refuses writes before the per-vessel rollout is verified", async () => {
    await conn.query("DELETE FROM pg_temp.sync_settings WHERE setting_key='section_h_ready_vessels'");
    await expect(createClassEntry(component, business, actor)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("returns active records and explicit read-only access independently of readiness and UUID backfill", async () => {
    const record = await createClassEntry(component, business, actor);
    await conn.query("DELETE FROM pg_temp.sync_settings WHERE setting_key='section_h_ready_vessels'");
    await conn.query("UPDATE pg_temp.component_class_regulatory SET ccruuid=NULL WHERE id=$1", [record.id]);
    expect(await listClassEntries(component, { ...actor, canEdit: false })).toHaveLength(1);
    expect(await componentClassAccess(component, { ...actor, canEdit: false })).toMatchObject({
      canView: true, canEdit: false, identityMode: "verified", reasonCode: "VIEW_ONLY",
    });
    expect(await componentClassAccess(component, actor)).toMatchObject({ reasonCode: "RECONCILIATION_PENDING", canView: true });
    const preview = { ...actor, canEdit: false, identityMode: "development-readonly" as const };
    expect(await componentClassAccess(component, preview)).toMatchObject({
      canView: true, canEdit: false, identityMode: "development-readonly", reasonCode: "DEVELOPMENT_READONLY",
    });
    expect(await listClassEntries(component, preview)).toHaveLength(1);
    await expect(listClassEntries(component, { ...preview, canEdit: true }, true)).rejects.toMatchObject({ statusCode: 403 });
    await expect(mutateClassEntry(record.id, {}, "delete", { ...preview, canEdit: true })).rejects.toMatchObject({ statusCode: 403 });
  });
  it("enforces known-UUID uniqueness without constraining society/type duplicates", async () => {
    const first = await createClassEntry(component, business, actor);
    const second = await createClassEntry(component, business, actor);
    await expect(conn.query("UPDATE pg_temp.component_class_regulatory SET ccruuid=$1 WHERE id=$2", [first.ccruuid, second.id]))
      .rejects.toMatchObject({ code: "23505" });
  });
  it("applies UUID full-row sync without natural-key collapse, local id collision or origin loss", async () => {
    const first = await createClassEntry(component, business, actor);
    const second = await createClassEntry(component, { ...business, certificateNumber: "OTHER" }, actor);
    const snapshots = (await conn.query("SELECT * FROM pg_temp.component_class_regulatory ORDER BY id")).rows;
    await conn.query("TRUNCATE pg_temp.component_class_regulatory RESTART IDENTITY");
    const unrelated = await createClassEntry(component, { ...business, certificateNumber: "Receiver local id collision" }, actor);
    expect(unrelated.id).toBe(snapshots[0].id);
    const columns = new Set(Object.keys(snapshots[0]));
    const localPool = { connect: async () => ({ query: conn.query.bind(conn), release: () => {} }) } as any;
    expect(await applyClassRegulatoryRows(localPool, snapshots, columns)).toMatchObject({ inserted: 2 });
    expect(await applyClassRegulatoryRows(localPool, snapshots, columns)).toMatchObject({ updated: 2 });
    expect((await conn.query("SELECT count(*)::int AS n FROM pg_temp.component_class_regulatory")).rows[0].n).toBe(3);
    const tombstone = { ...snapshots[0], is_deleted: true, deleted_by_uuid: actor.userId,
      deleted_at: "2027-01-01T00:00:00Z", updated_at: "2027-01-01T00:00:00Z" };
    await applyClassRegulatoryRows(localPool, [tombstone], columns);
    const deleted = (await conn.query("SELECT * FROM pg_temp.component_class_regulatory WHERE ccruuid=$1", [first.ccruuid])).rows[0];
    expect(deleted.deleted_by_uuid).toBe(actor.userId);
    expect(deleted.updated_at.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    // Older delivery must not resurrect a more recent tombstone.
    await applyClassRegulatoryRows(localPool, [snapshots[0]], columns);
    expect((await conn.query("SELECT is_deleted FROM pg_temp.component_class_regulatory WHERE ccruuid=$1", [first.ccruuid])).rows[0].is_deleted).toBe(true);
    await applyClassRegulatoryRows(localPool, [{ ...tombstone, is_deleted: false, deleted_by_uuid: null,
      deleted_at: null, updated_at: "2027-01-02T00:00:00Z" }], columns);
    const restored = (await conn.query("SELECT * FROM pg_temp.component_class_regulatory WHERE ccruuid=$1", [first.ccruuid])).rows[0];
    expect(restored).toMatchObject({ is_deleted: false, deleted_at: null, deleted_by_uuid: null, created_by_uuid: actor.userId });
    expect(first.ccruuid).not.toBe(second.ccruuid);
    await expect(applyClassRegulatoryRows(localPool, [{ ...snapshots[0], ccruuid: null }], columns)).rejects.toThrow();
    await expect(applyClassRegulatoryRows(localPool, snapshots, new Set())).rejects.toThrow();
    await expect(applyClassRegulatoryRows(localPool, [{ ...snapshots[0], vessel_code: "OTHER" }], columns)).rejects.toThrow();
    await applyClassRegulatoryRows(localPool, [{ ...snapshots[0], updated_at: "2027-02-01T00:00:00.123456Z" }], columns);
    // Millisecond Date comparison would incorrectly treat these two updates as equal.
    await applyClassRegulatoryRows(localPool, [{ ...snapshots[0], certificate_number: "STALE", updated_at: "2027-02-01T00:00:00.123455Z" }], columns);
    expect((await conn.query("SELECT certificate_number FROM pg_temp.component_class_regulatory WHERE ccruuid=$1", [first.ccruuid])).rows[0].certificate_number).not.toBe("STALE");
    expect(CLASS_REGULATORY_REQUIRED_COLUMNS).toContain("deleted_at");
  });
});
