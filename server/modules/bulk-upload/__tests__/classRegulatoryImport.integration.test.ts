import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import * as XLSX from "xlsx";
import * as schema from "@shared/schema";
import { CLASS_REGULATORY_TEMPLATE_FIELDS } from "@shared/bulkImportTemplateFields";
import { resolvePostgres } from "../../../postgresClient";
import { previewSectionHImport, commitSectionHImport, sectionHPreview, selectedSectionHRows } from "../services/classRegulatoryImport";
import { readSectionHWorkbook, importSurveyDate } from "../services/classRegulatoryWorkbook";
import { classRegulatoryTemplate } from "../services/classRegulatoryTemplate";
import { tenantStorage } from "../../../utils/asyncLocalStorage";

const fixture = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../../db", () => ({ getDb: async () => fixture.db }));
vi.mock("../../../storage", () => ({ storage: {} }));
const vessel = "adf68a19-27d7-4a1a-855f-000000000711";
const otherVessel = "adf68a19-27d7-4a1a-855f-000000000712";
const component = "adf68a19-27d7-4a1a-855f-000000000713";
const otherComponent = "adf68a19-27d7-4a1a-855f-000000000714";
const actor = { userId: "adf68a19-27d7-4a1a-855f-000000000715", role: "Editor", userType: "Office" as const,
  canEdit: true, identityMode: "verified" as const };
const values = ["001.010", "DNV", "ABS-123", "01-10-2026", "02-10-2026", "ANN", "Requirement", "DNV", "Information", "TEST-A"];
function workbook(rows = [values], options: any = {}) {
  const book = XLSX.utils.book_new();
  if (options.date1904) book.Workbook = { WBProps: { date1904: true } };
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([options.headers || CLASS_REGULATORY_TEMPLATE_FIELDS.map(f => f.header), ...rows]), "Import");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
function changed(changes: Record<number, any>) {
  const row = [...values];
  Object.entries(changes).forEach(([key, value]) => { row[Number(key)] = value; });
  return row;
}
async function preview(rows = [values], mode: "add" | "update" | "upsert" = "upsert") {
  return previewSectionHImport(actor, vessel, mode, workbook(rows), "fixture.xlsx", "Import");
}
async function commit(fileToken: string, extra = {}) {
  return commitSectionHImport(actor, { fileToken, type: "class-regulatory", vesselId: vessel, mode: "upsert", ...extra },
    async () => "local:fixture-only-no-disk-file", () => {});
}
let conn: any, pool: any;
const tables = ["vessels", "components", "component_class_regulatory", "master_lists", "audit_log",
  "import_history", "import_change_log", "bulk_import_history", "bulk_import_errors"];

describe("Section H bulk import — isolated PostgreSQL TEMP tables", () => {
  beforeAll(async () => {
    const postgres = await resolvePostgres();
    if (!postgres) throw new Error("Development PostgreSQL is required for isolated integration tests.");
    pool = postgres.pool;
    conn = await pool.connect();
    for (const name of tables) await conn.query(`CREATE TEMP TABLE "${name}" (LIKE public."${name}" INCLUDING ALL)`);
    // Exercise ambiguity handling for installations without the optional legacy index.
    // Only the session-local clone is changed; the public index is untouched.
    await conn.query("DROP INDEX IF EXISTS pg_temp.components_vessel_id_component_code_idx");
    fixture.db = drizzle(conn, { schema });
  }, 30_000);
  afterAll(async () => {
    if (conn) { await conn.query("DISCARD TEMP"); conn.release(); }
    if (pool) await pool.end();
  });
  beforeEach(async () => {
    await conn.query(`TRUNCATE ${tables.map(name => `pg_temp."${name}"`).join(",")} RESTART IDENTITY`);
    await conn.query(`INSERT INTO pg_temp.vessels(id,vuuid,code,name) VALUES
      ('TEST-A',$1,'TEST-A','Import Vessel A'),('TEST-B',$2,'TEST-B','Import Vessel B')`, [vessel, otherVessel]);
    await conn.query(`INSERT INTO pg_temp.components(id,cuuid,vessel_id,component_code,name) VALUES
      ('legacy-id-not-cuuid',$1,$2,'001.010','Import Component A'),
      ('other-legacy-id',$3,$4,'001.010','Import Component B')`, [component, vessel, otherComponent, otherVessel]);
    await conn.query(`INSERT INTO pg_temp.master_lists(list_type,list_key,list_value) VALUES
      ('classificationSociety','DNV','Det Norske Veritas'),('classificationSociety','ABS','American Bureau'),
      ('surveyType','ANN','Annual Survey')`);
    await conn.query("UPDATE pg_temp.master_lists SET category='Class' WHERE list_type='surveyType'");
  });

  it("dry-run is read-only; commit uses selected vessel cuuid, not legacy id or the other vessel's code match", async () => {
    const p = await preview();
    expect(p.summary).toEqual({ ok: 1, errors: 0, warnings: 0 });
    expect((await conn.query("SELECT count(*)::int AS n FROM pg_temp.audit_log")).rows[0].n).toBe(0);
    expect((await conn.query("SELECT count(*)::int AS n FROM pg_temp.component_class_regulatory")).rows[0].n).toBe(0);
    expect(await commit(p.fileToken)).toMatchObject({ created: 1, updated: 0, failed: 0 });
    const saved = (await conn.query("SELECT * FROM pg_temp.component_class_regulatory")).rows[0];
    expect(saved).toMatchObject({ component_id: component, component_code: "001.010", vessel_code: "TEST-A", certificate_number: "ABS-123" });
    expect(saved.ccruuid).toMatch(/^[0-9a-f-]{36}$/);
    expect((await conn.query("SELECT user_id,source FROM pg_temp.audit_log")).rows[0]).toEqual({ user_id: actor.userId, source: "bulk_import" });
    expect((await conn.query("SELECT count(*)::int AS n FROM pg_temp.import_change_log")).rows[0].n).toBe(1);
    await expect(commit(p.fileToken)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("repeat import updates the same canonical entry and blank cells preserve values", async () => {
    await commit((await preview()).fileToken);
    const before = (await conn.query("SELECT * FROM pg_temp.component_class_regulatory")).rows[0];
    const p = await preview([changed({ 1: "", 3: "", 4: "", 5: "", 6: "", 7: "", 8: "" })]);
    expect(p.summary.errors).toBe(0);
    expect(await commit(p.fileToken)).toMatchObject({ created: 0, updated: 1 });
    const after = (await conn.query("SELECT * FROM pg_temp.component_class_regulatory")).rows[0];
    for (const key of ["id", "ccruuid", "component_id", "created_by_uuid", "class_requirements", "information", "last_class_survey", "next_survey_due", "class_code"])
      expect(after[key]).toEqual(before[key]);
    expect(after.updated_at.getTime()).toBeGreaterThanOrEqual(before.updated_at.getTime());
  });
  it("supports add-only and update-only without creating duplicate entries", async () => {
    const absent = await preview([values], "update");
    expect(absent.rows[0].normalized.Action).toBe("skip");
    expect(await commit(absent.fileToken, { mode: "update" })).toMatchObject({ created: 0, skipped: 1 });
    await commit((await preview()).fileToken);
    const exists = await preview([values], "add");
    expect(await commit(exists.fileToken, { mode: "add" })).toMatchObject({ created: 0, updated: 0, skipped: 1 });
  });
  it("requires certificate numbers and exact case/punctuation; duplicate workbook keys all fail", async () => {
    expect((await preview([changed({ 2: "" })])).summary.errors).toBe(1);
    expect((await preview([values, values])).summary.errors).toBe(2);
    await commit((await preview()).fileToken);
    expect(await commit((await preview([changed({ 2: "abs-123" })])).fileToken)).toMatchObject({ created: 1 });
    expect(await commit((await preview([changed({ 2: "ABS 123" })])).fileToken)).toMatchObject({ created: 1 });
  });
  it("rejects different/missing/fleet/deleted/ambiguous components within the selected vessel", async () => {
    expect((await preview([changed({ 9: "TEST-B" })])).summary.errors).toBe(1);
    await conn.query("UPDATE pg_temp.components SET vessel_id=$1 WHERE cuuid=$2", [otherVessel, component]);
    expect((await preview()).summary.errors).toBe(1);
    await conn.query("UPDATE pg_temp.components SET vessel_id=$1,data_scope='fleet' WHERE cuuid=$2", [vessel, component]);
    expect((await preview()).summary.errors).toBe(1);
    await conn.query("UPDATE pg_temp.components SET data_scope='vessel',is_deleted=true WHERE cuuid=$1", [component]);
    expect((await preview()).summary.errors).toBe(1);
    await conn.query("UPDATE pg_temp.components SET is_deleted=false WHERE cuuid=$1", [component]);
    await conn.query("UPDATE pg_temp.components SET vessel_id=$1 WHERE cuuid=$2", [vessel, otherComponent]);
    expect((await preview()).rows[0].errors.join()).toContain("ambiguous");
  });
  it.each(["delete", "rename", "move", "replace", "duplicate"])("rejects component %s between preview and commit", async change => {
    const p = await preview();
    if (change === "delete") await conn.query("UPDATE pg_temp.components SET is_deleted=true WHERE cuuid=$1", [component]);
    if (change === "rename") await conn.query("UPDATE pg_temp.components SET component_code='DIFFERENT' WHERE cuuid=$1", [component]);
    if (change === "move") await conn.query("UPDATE pg_temp.components SET vessel_id=$1 WHERE cuuid=$2", [otherVessel, component]);
    if (change === "replace") await conn.query("UPDATE pg_temp.components SET cuuid='adf68a19-27d7-4a1a-855f-000000000799' WHERE cuuid=$1", [component]);
    if (change === "duplicate") await conn.query("UPDATE pg_temp.components SET vessel_id=$1 WHERE cuuid=$2", [vessel, otherComponent]);
    expect(await commit(p.fileToken)).toMatchObject({ created: 0, failed: 1 });
    expect((await conn.query("SELECT count(*)::int AS n FROM pg_temp.component_class_regulatory")).rows[0].n).toBe(0);
  });
  it("rejects changed target rows and removed or ambiguous existing certificate matches", async () => {
    await commit((await preview()).fileToken);
    const p = await preview();
    await conn.query("UPDATE pg_temp.component_class_regulatory SET information='Changed after preview'");
    expect(await commit(p.fileToken)).toMatchObject({ updated: 0, failed: 1 });
    await conn.query("UPDATE pg_temp.component_class_regulatory SET is_deleted=true");
    expect((await preview()).rows[0].errors.join()).toContain("removed");
    await conn.query("UPDATE pg_temp.component_class_regulatory SET is_deleted=false");
    await conn.query(`INSERT INTO pg_temp.component_class_regulatory(component_id,component_code,vessel_code,classification_society,survey_type,certificate_number,ccruuid,created_by)
      VALUES($1,'001.010','TEST-A','DNV','Annual','ABS-123','adf68a19-27d7-4a1a-855f-000000000798',$2)`, [component, actor.userId]);
    expect((await preview()).rows[0].errors.join()).toContain("Multiple active");
  });
  it("rejects invalid masters, ambiguous labels, society code mismatches and invalid dates", async () => {
    for (const change of [{ 1: "Unknown" }, { 7: "ABS" }, { 3: "2026-10-01" }, { 3: "31-02-2026" }, { 4: "01-01-2020" }])
      expect((await preview([changed(change)])).summary.errors).toBe(1);
    await conn.query("UPDATE pg_temp.master_lists SET list_value='Det Norske Veritas' WHERE list_key='ABS'");
    expect((await preview([changed({ 1: "Det Norske Veritas" })])).summary.errors).toBe(1);
    await conn.query("UPDATE pg_temp.master_lists SET is_active=false WHERE list_key='DNV'");
    expect((await preview()).summary.errors).toBe(1);
  });
  it("detects master changes after preview and revalidates dates against retained saved values", async () => {
    const p = await preview();
    await conn.query("UPDATE pg_temp.master_lists SET is_active=false WHERE list_key='DNV'");
    expect(await commit(p.fileToken)).toMatchObject({ failed: 1, created: 0 });
    await conn.query("UPDATE pg_temp.master_lists SET is_active=true WHERE list_key='DNV'");
    await commit((await preview()).fileToken);
    expect((await preview([changed({ 3: "03-10-2026", 4: "" })])).summary.errors).toBe(1);
  });
  it("binds tokens to actor, tenant, mode, vessel and type, validates exact row numbers and expires at commit", async () => {
    const p = await preview([values, changed({ 2: "" })]);
    const body = { fileToken: p.fileToken, vesselId: vessel, mode: "upsert", type: "class-regulatory" };
    for (const tamper of [{ vesselId: otherVessel }, { mode: "add" }, { type: "components" }])
      expect(() => sectionHPreview(actor, { ...body, ...tamper })).toThrow();
    expect(() => sectionHPreview({ ...actor, userId: otherComponent }, body)).toThrow();
    await tenantStorage.run({ tuid: "other-tenant", db: fixture.db, pool } as any, async () => {
      expect(() => sectionHPreview(actor, body)).toThrow();
    });
    const cached = sectionHPreview(actor, body);
    expect(() => selectedSectionHRows(cached, undefined)).toThrow();
    for (const indices of [[1], [3], [2, 2], [999], ["2"]]) expect(() => selectedSectionHRows(cached, indices)).toThrow();
    const partial = await commit(p.fileToken, { rowIndices: [2] });
    expect(partial).toMatchObject({ created: 1, failed: 1 });
    expect(partial.rowResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ rowNumber: 2, action: "created" }),
      expect.objectContaining({ rowNumber: 3, action: "failed" }),
    ]));
    expect((await conn.query("SELECT status,created,error_message FROM pg_temp.import_history WHERE id=$1", [partial.historyId])).rows[0])
      .toMatchObject({ status: "partial", created: 1 });
    const persistedErrors = (await conn.query("SELECT error_message FROM pg_temp.import_history WHERE id=$1", [partial.historyId])).rows[0];
    expect(JSON.parse(persistedErrors.error_message)).toHaveLength(1);
    expect((await conn.query("SELECT status,success_count,failed_count FROM pg_temp.bulk_import_history WHERE biuuid=$1", [partial.historyId])).rows[0])
      .toMatchObject({ status: "partial", success_count: 1, failed_count: 1 });
    const fresh = await preview();
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3_600_001);
    try { expect(() => sectionHPreview(actor, { ...body, fileToken: fresh.fileToken })).toThrow(/expired/); }
    finally { clock.mockRestore(); }
  });
  it("refuses Ship/mock identities and prevents simultaneous claims or stale absent-key creates", async () => {
    await expect(previewSectionHImport({ ...actor, userType: "Ship" }, vessel, "upsert", workbook(), "fixture.xlsx")).rejects.toThrow();
    await expect(previewSectionHImport({ ...actor, identityMode: undefined }, vessel, "upsert", workbook(), "fixture.xlsx")).rejects.toThrow();
    const first = await preview();
    const second = await preview();
    await commit(first.fileToken);
    expect(await commit(second.fileToken)).toMatchObject({ created: 0, updated: 0, failed: 1 });
    const claimed = await preview();
    const body = { fileToken: claimed.fileToken, vesselId: vessel };
    sectionHPreview(actor, body, true);
    expect(() => sectionHPreview(actor, body, true)).toThrow(/already/);
  });
  it("rolls back a row on required audit or import-change failure", async () => {
    for (const table of ["audit_log", "import_change_log"]) {
      await conn.query(`ALTER TABLE pg_temp.${table} ADD CONSTRAINT fail_bulk_row CHECK (false) NOT VALID`);
      try {
        expect(await commit((await preview()).fileToken)).toMatchObject({ created: 0, failed: 1 });
        expect((await conn.query("SELECT count(*)::int AS n FROM pg_temp.component_class_regulatory")).rows[0].n).toBe(0);
      } finally { await conn.query(`ALTER TABLE pg_temp.${table} DROP CONSTRAINT fail_bulk_row`); }
    }
  });
  it("trims outer certificate whitespace consistently without changing canonical matching identity", async () => {
    await commit((await preview()).fileToken);
    const id = (await conn.query("SELECT ccruuid FROM pg_temp.component_class_regulatory")).rows[0].ccruuid;
    await conn.query("UPDATE pg_temp.component_class_regulatory SET certificate_number=$1", ["\t\u00a0 ABS-123 \r\n"]);
    const p = await preview();
    expect(p.rows[0].normalized.Action).toBe("update");
    expect(await commit(p.fileToken)).toMatchObject({ created: 0, updated: 1 });
    expect((await conn.query("SELECT ccruuid FROM pg_temp.component_class_regulatory")).rows).toEqual([{ ccruuid: id }]);
  });
  it("prefers canonical master codes over display labels without letting inactive codes fall through", async () => {
    await conn.query("UPDATE pg_temp.master_lists SET list_value='DNV' WHERE list_key='ABS'");
    expect((await preview()).summary.errors).toBe(0);
    await conn.query("UPDATE pg_temp.master_lists SET is_active=false WHERE list_key='DNV'");
    expect((await preview()).summary.errors).toBe(1);
  });
  it("resolves a unique Survey Type value, previews its value and saves the canonical key and snapshot", async () => {
    const p = await preview([changed({ 5: "Annual Survey" })]);
    expect(p.rows[0]).toMatchObject({ status: "ok", normalized: { "Survey Type/Category": "Annual Survey/Class" } });
    expect(await commit(p.fileToken)).toMatchObject({ created: 1, failed: 0 });
    expect((await conn.query("SELECT survey_type_key,survey_type FROM pg_temp.component_class_regulatory")).rows)
      .toEqual([{ survey_type_key: "ANN", survey_type: "Annual Survey" }]);
  });
  it("rejects duplicate active survey values across categories even on updates, without guessing from the saved key", async () => {
    await commit((await preview()).fileToken);
    await conn.query("UPDATE pg_temp.master_lists SET category='Class' WHERE list_key='ANN'");
    await conn.query(`INSERT INTO pg_temp.master_lists(list_type,list_key,list_value,category)
      VALUES('surveyType','STT-ANN','Annual Survey','Statutory')`);
    const p = await preview([changed({ 5: "Annual Survey" })]);
    expect(p.summary).toMatchObject({ ok: 0, errors: 1 });
    expect(p.rows[0].errors.join()).toContain('"Annual Survey" matches multiple active Survey Types');
    expect(p.rows[0].normalized["Survey Type/Category"]).toBe("Annual Survey");
    await expect(commit(p.fileToken)).rejects.toThrow(/errors/);
    expect((await conn.query("SELECT survey_type_key FROM pg_temp.component_class_regulatory")).rows)
      .toEqual([{ survey_type_key: "ANN" }]);
    expect((await conn.query("SELECT count(*)::int AS n FROM pg_temp.master_lists WHERE list_type='surveyType'")).rows[0].n).toBe(2);
  });
  it("preserves exact legacy survey key compatibility and shows its value even with duplicate labels", async () => {
    await conn.query(`INSERT INTO pg_temp.master_lists(list_type,list_key,list_value,category)
      VALUES('surveyType','STT-ANN','Annual Survey','Statutory')`);
    const p = await preview([changed({ 5: "STT-ANN" })]);
    expect(p.rows[0].normalized["Survey Type/Category"]).toBe("Annual Survey/Statutory");
    expect(await commit(p.fileToken)).toMatchObject({ created: 1, failed: 0 });
    expect((await conn.query("SELECT survey_type_key,survey_type FROM pg_temp.component_class_regulatory")).rows)
      .toEqual([{ survey_type_key: "STT-ANN", survey_type: "Annual Survey" }]);
    await conn.query("UPDATE pg_temp.master_lists SET list_value='STT-ANN' WHERE list_key='ANN'");
    // An inactive exact key must not fall through to another master's active label.
    await conn.query("UPDATE pg_temp.master_lists SET is_active=false WHERE list_key='STT-ANN'");
    expect((await preview([changed({ 5: "STT-ANN" })])).summary.errors).toBe(1);
  });
  it("ignores inactive/deleted duplicate labels but rejects inactive-only or unknown survey values", async () => {
    await conn.query(`INSERT INTO pg_temp.master_lists(list_type,list_key,list_value,is_active,is_deleted)
      VALUES('surveyType','RETIRED','Annual Survey',false,false),('surveyType','REMOVED','Annual Survey',true,true)`);
    expect((await preview([changed({ 5: "Annual Survey" })])).summary.errors).toBe(0);
    await conn.query("UPDATE pg_temp.master_lists SET is_active=false WHERE list_key='ANN'");
    expect((await preview([changed({ 5: "Annual Survey" })])).summary.errors).toBe(1);
    expect((await preview([changed({ 5: "Unknown Survey" })])).summary.errors).toBe(1);
  });
  it.each(["duplicate", "rename", "inactive", "deleted"])("revalidates survey values after a master becomes %s between preview and save", async change => {
    const p = await preview([changed({ 5: "Annual Survey" })]);
    if (change === "duplicate") await conn.query(`INSERT INTO pg_temp.master_lists(list_type,list_key,list_value,category)
      VALUES('surveyType','STT-ANN','Annual Survey','Statutory')`);
    if (change === "rename") await conn.query("UPDATE pg_temp.master_lists SET list_value='Renamed Survey' WHERE list_key='ANN'");
    if (change === "inactive") await conn.query("UPDATE pg_temp.master_lists SET is_active=false WHERE list_key='ANN'");
    if (change === "deleted") await conn.query("UPDATE pg_temp.master_lists SET is_deleted=true WHERE list_key='ANN'");
    expect(await commit(p.fileToken)).toMatchObject({ created: 0, failed: 1 });
    expect((await conn.query("SELECT count(*)::int AS n FROM pg_temp.component_class_regulatory")).rows[0].n).toBe(0);
  });
  it("preserves a retired survey key and snapshot on blank updates", async () => {
    await commit((await preview()).fileToken);
    await conn.query("UPDATE pg_temp.master_lists SET is_active=false WHERE list_key='ANN'");
    const p = await preview([changed({ 5: "", 8: "Updated information" })]);
    expect(p.rows[0].normalized["Survey Type/Category"]).toBe("Annual Survey/Class");
    expect(await commit(p.fileToken)).toMatchObject({ updated: 1, failed: 0 });
    expect((await conn.query("SELECT survey_type_key,survey_type,information FROM pg_temp.component_class_regulatory")).rows)
      .toEqual([{ survey_type_key: "ANN", survey_type: "Annual Survey", information: "Updated information" }]);
  });
  it("keeps ten import columns with paired survey references and explicit ambiguity guidance", async () => {
    const template = await classRegulatoryTemplate(vessel);
    const book = XLSX.read(template, { type: "buffer" });
    const reference = XLSX.utils.sheet_to_json(book.Sheets["Master References"], { header: 1 }) as string[][];
    expect(reference[0]).toEqual(["Classification Society", "Class Code", "Survey Type/Category"]);
    expect(reference.some(row => row[2] === "Annual Survey/Class")).toBe(true);
    expect(reference.flat()).not.toContain("ANN");
    expect(reference.flat()).toContain("DNV"); // Classification Society codes remain unchanged.
    const guide = XLSX.utils.sheet_to_json(book.Sheets["Field Mapping Guide"], { header: 1 }) as string[][];
    expect(guide.find(row => row[0] === "Survey Type/Category")?.[1]).toContain("duplicate pairs are rejected");
    expect(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 })[0])
      .toEqual(CLASS_REGULATORY_TEMPLATE_FIELDS.map(f => f.header));
  });
  it("imports distinct categories using slash labels while persisting only the original keys and value snapshots", async () => {
    await conn.query(`INSERT INTO pg_temp.master_lists(list_type,list_key,list_value,category)
      VALUES('surveyType','STT-ANN','Annual Survey','Statutory')`);
    const p = await preview([
      changed({ 2: "CLASS", 5: "Annual Survey/Class" }),
      changed({ 2: "STATUTORY", 5: "Annual Survey/Statutory" }),
    ]);
    expect(p.summary).toMatchObject({ ok: 2, errors: 0 });
    expect(p.rows.map(r => r.normalized["Survey Type/Category"]))
      .toEqual(["Annual Survey/Class", "Annual Survey/Statutory"]);
    expect(await commit(p.fileToken)).toMatchObject({ created: 2, failed: 0 });
    expect((await conn.query("SELECT survey_type_key,survey_type FROM pg_temp.component_class_regulatory ORDER BY certificate_number")).rows)
      .toEqual([{ survey_type_key: "ANN", survey_type: "Annual Survey" }, { survey_type_key: "STT-ANN", survey_type: "Annual Survey" }]);
  });
  it("accepts the old Survey Type header but continues rejecting any other changed or reordered header", async () => {
    const old = CLASS_REGULATORY_TEMPLATE_FIELDS.map(f => f.header);
    old[5] = "Survey Type";
    for (const input of ["ANN", "Annual Survey", "Annual Survey/Class"]) {
      const p = await previewSectionHImport(actor, vessel, "upsert",
        workbook([changed({ 5: input })], { headers: old }), "old.xlsx");
      expect(p.summary.errors).toBe(0);
      expect(p.columns[5]).toBe("Survey Type/Category");
      expect(p.rows[0].normalized["Survey Type/Category"]).toBe("Annual Survey/Class");
    }
    const invalid = [...old]; [invalid[4], invalid[5]] = [invalid[5], invalid[4]];
    expect(() => readSectionHWorkbook(workbook([values], { headers: invalid }), "bad.xlsx")).toThrow(/Column 5/);
    invalid[4] = old[4]; invalid[5] = "Survey";
    expect(() => readSectionHWorkbook(workbook([values], { headers: invalid }), "bad.xlsx")).toThrow(/Column 6/);
  });
  it("rejects duplicate complete pairs and inactive-only composite inputs without modifying masters", async () => {
    await conn.query(`INSERT INTO pg_temp.master_lists(list_type,list_key,list_value,category)
      VALUES('surveyType','DUP-ANN','Annual Survey','Class')`);
    const p = await preview([changed({ 5: "Annual Survey/Class" })]);
    expect(p.rows[0]).toMatchObject({ status: "error", normalized: { "Survey Type/Category": "Annual Survey/Class" } });
    expect(p.rows[0].errors.join()).toContain("unique Survey Type/Category pair");
    await conn.query("UPDATE pg_temp.master_lists SET is_active=false WHERE list_key='DUP-ANN'");
    expect((await preview([changed({ 5: "Annual Survey/Class" })])).summary.errors).toBe(0);
    await conn.query("UPDATE pg_temp.master_lists SET is_deleted=true WHERE list_key='ANN'");
    expect((await preview([changed({ 5: "Annual Survey/Class" })])).summary.errors).toBe(1);
  });
  it.each(["ANN", "Annual Survey/Class", ""])("detects category changes after preview for %s, including preserved references", async input => {
    await commit((await preview()).fileToken);
    const p = await preview([changed({ 5: input, 8: "Should not save" })]);
    await conn.query("UPDATE pg_temp.master_lists SET category='Statutory' WHERE list_key='ANN'");
    expect(await commit(p.fileToken)).toMatchObject({ updated: 0, created: 0, failed: 1 });
    expect((await conn.query("SELECT information,survey_type_key FROM pg_temp.component_class_regulatory")).rows)
      .toEqual([{ information: "Information", survey_type_key: "ANN" }]);
  });
  it("does not invent categories for incomplete masters or offer them as composite template choices", async () => {
    await conn.query("UPDATE pg_temp.master_lists SET category=null WHERE list_key='ANN'");
    expect((await preview([changed({ 5: "Annual Survey/Category unavailable" })])).summary.errors).toBe(1);
    const legacy = await preview();
    expect(legacy.summary.errors).toBe(0);
    expect(legacy.rows[0].normalized["Survey Type/Category"]).toBe("Annual Survey/Category unavailable");
    const book = XLSX.read(await classRegulatoryTemplate(vessel), { type: "buffer" });
    expect(XLSX.utils.sheet_to_json(book.Sheets["Master References"], { header: 1 }).flat())
      .not.toContain("Annual Survey/Category unavailable");
  });
  it("compares complete pairs without splitting slash-containing values and detects formatted collisions", async () => {
    await conn.query("UPDATE pg_temp.master_lists SET list_value='Annual/Occasional Survey' WHERE list_key='ANN'");
    expect((await preview([changed({ 5: "Annual/Occasional Survey/Class" })])).summary.errors).toBe(0);
    await conn.query(`INSERT INTO pg_temp.master_lists(list_type,list_key,list_value,category)
      VALUES('surveyType','SLASH','Annual','Occasional Survey/Class')`);
    expect((await preview([changed({ 5: "Annual/Occasional Survey/Class" })])).summary.errors).toBe(1);
  });
  it("generates exact template headers and parses strict dates/1904 serial dates/text codes", async () => {
    const template = await classRegulatoryTemplate(vessel);
    const book = XLSX.read(template, { type: "buffer" });
    const firstRow = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 })[0];
    expect(firstRow).toEqual(CLASS_REGULATORY_TEMPLATE_FIELDS.map(f => f.header));
    const parsed = readSectionHWorkbook(workbook([changed({ 3: 1 })], { date1904: true }), "test.xlsx");
    expect(parsed.rows[0].values.lastClassSurveyDate).toBe("02-01-1904");
    expect(parsed.rows[0].values.componentCode).toBe("001.010");
    expect(importSurveyDate("29-02-2024")).toBe("29-02-2024");
    for (const date of ["29-02-2025", "31-04-2026", "2026-01-02", "02-Jan-2026"]) expect(() => importSurveyDate(date)).toThrow();
    expect(() => readSectionHWorkbook(workbook(Array.from({ length: 1001 }, () => values)), "large.xlsx")).toThrow(/1?000/);
    expect(() => readSectionHWorkbook(Buffer.from("Component Code,Certificate Number\n001.010,A"), "renamed.xlsx")).toThrow(/actual Excel/);
    const xls = XLSX.write(XLSX.read(workbook(), { type: "buffer" }), { type: "buffer", bookType: "biff8" });
    expect(readSectionHWorkbook(xls, "legacy.xls").rows).toHaveLength(1);
  });
  it("generates a generic template without a vessel but still refuses unscoped validation", async () => {
    const template = await classRegulatoryTemplate("");
    const book = XLSX.read(template, { type: "buffer" });
    expect(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 })[0])
      .toEqual(CLASS_REGULATORY_TEMPLATE_FIELDS.map(f => f.header));
    const guide = XLSX.utils.sheet_to_json(book.Sheets["Field Mapping Guide"], { header: 1 }) as string[][];
    const instruction = guide.find(row => row[0] === "Selected vessel")?.[1];
    expect(instruction).toContain("Select a vessel");
    expect(instruction).not.toContain("undefined");
    expect(book.Sheets["Master References"]).toBeDefined();
    await expect(classRegulatoryTemplate(otherComponent)).rejects.toThrow(/vessel/);
    await expect(previewSectionHImport(actor, "", "upsert", workbook(), "fixture.xlsx"))
      .rejects.toThrow(/vessel UUID/);
  });
  it("returns row-level validation lists for real Excel dates and field-specific invalid calendars", async () => {
    const p = await previewSectionHImport(actor, vessel, "upsert",
      workbook([changed({ 2: "NUMERIC", 3: 46296, 4: 46297 }), changed({ 2: "BAD-DATE", 3: "31-02-2026" })]),
      "dates.xlsx");
    expect(p.summary).toEqual({ ok: 1, errors: 1, warnings: 0 });
    expect(p.rows[0]).toMatchObject({ row: 2, status: "ok", normalized: {
      "Last Class Survey Date": "01-10-2026", "Next Class Survey": "02-10-2026", Action: "create",
    } });
    expect(p.rows[1]).toMatchObject({ row: 3, status: "error" });
    expect(p.rows[1].errors.join("; ")).toContain("Last Class Survey Date:");
    expect((await conn.query("SELECT count(*)::int AS n FROM pg_temp.component_class_regulatory")).rows[0].n).toBe(0);
  });
});
