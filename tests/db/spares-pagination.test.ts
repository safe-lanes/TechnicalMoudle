/**
 * Isolated TEMP fixtures on one connection; no user data is changed.
 * node --import tsx --test tests/db/spares-pagination.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import ExcelJS from "exceljs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getPool } from "../../server/db";
import { tenantStorage } from "../../server/utils/asyncLocalStorage";
import { sparePageQuery } from "../../shared/sparesPagination";
import { queryPage, queryValues, queryLocations } from "../../server/modules/spares/repositories/sparesPagingRepository";
import { resolveSparesScope } from "../../server/modules/spares/repositories/sparesPagingScope";
import { writeSpareExport } from "../../server/modules/spares/services/sparesExportService";
import { parse, validatePagedBulk } from "../../server/modules/spares/controllers/sparesPagingController";

test("Spares bounded SQL pages, full-scope controls and streaming exports", async t => {
  const pool = await getPool(), client = await pool.connect();
  const directory = await mkdtemp(path.join(tmpdir(), "spares-test-"));
  try {
    await client.query(`CREATE TEMP TABLE spares (
      id int PRIMARY KEY,suuid text,vessel_id text,data_scope text DEFAULT 'vessel',deleted boolean DEFAULT false,
      is_deleted boolean DEFAULT false,is_active boolean DEFAULT true,part_code text,part_name text,part_number text,
      component_code text,component_id text,component_name text,critical text,criticality text,is_rotation_item boolean DEFAULT false,
      rob int,min int,max int,location text,location_2 text,rob_location_a int,rob_location_b int,ihm text, fleet_equipment_code text)`);
    await client.query(`CREATE TEMP TABLE components (id text,cuuid text,vessel_id text,data_scope text DEFAULT 'vessel',
      is_deleted boolean DEFAULT false,is_active boolean DEFAULT true,component_code text,name text,component_category text,
      fleet_equipment_code text,fleet_equipment_name text)`);
    await client.query(`CREATE TEMP TABLE spare_component_links (id int,vessel_id text,spare_uuid text,spare_id int,component_id text,is_deleted boolean DEFAULT false)`);
    await client.query(`CREATE TEMP TABLE locations (id int,vessel_id text,location_name text)`);
    await client.query(`CREATE TEMP TABLE spare_location_stock (id int,spare_uuid text,spare_id int,location_id int,qty int)`);
    await client.query(`CREATE TEMP TABLE spares_history (id int,spare_uuid text,vessel_id text,timestamp_utc timestamp,date_local text,
      part_code text,part_name text,component_name text,event_type text,qty_change int,rob_after int,reference text)`);
    await client.query(`CREATE TEMP TABLE master_user_vessels (user_uuid text,vessel_id text,is_active boolean)`);
    await client.query(`INSERT INTO master_user_vessels VALUES ('user','v1',true),('user','v2',false)`);
    await client.query(`INSERT INTO components(id,cuuid,vessel_id,component_code,name,fleet_equipment_code,fleet_equipment_name)
      VALUES ('legacy','c1','v1','6.1','Engine','FE1','Fleet Engine'),('other','c2','v1','8.2','Pump','FE2','Fleet Pump')`);
    await client.query(`INSERT INTO spares(id,suuid,vessel_id,part_code,part_name,part_number,component_code,component_id,component_name,
      critical,criticality,rob,min,max,location,location_2,rob_location_a,rob_location_b,ihm)
      SELECT g,'s'||g,'v1','SP-'||lpad(g::text,3,'0'),CASE WHEN g=41 THEN 'LAST Literal%_\\ Part' ELSE 'Part '||g END,
      'PN-'||g,CASE WHEN g=40 THEN '6.10' ELSE '6.1.1' END,'c1','Engine',
      CASE WHEN g%2=0 THEN 'Critical' ELSE 'No' END,'Non-critical',g,5,100,'Bay A','Bay B',g,0,'No'
      FROM generate_series(1,41) g`);
    await client.query(`INSERT INTO spares(id,suuid,vessel_id,part_code,part_name,rob,min,deleted) VALUES
      (42,'s42','v2','SP-041','Other vessel',1,5,false),(43,'s43','v1','Deleted','Deleted',1,5,true),
      (44,'s44','v1','SP-041','Duplicate master',1,5,false)`);
    await client.query(`INSERT INTO spare_component_links VALUES (1,'v1','s41',41,'c2',false),(2,'v1','s43',43,'c1',false)`);
    await client.query(`INSERT INTO locations SELECT g,'v1','Location '||lpad(g::text,3,'0') FROM generate_series(1,31) g`);
    await client.query(`INSERT INTO spare_location_stock SELECT g,'s'||g,g,1,g FROM generate_series(1,41) g`);
    await client.query(`INSERT INTO spare_location_stock SELECT 100+g,'s1',1,g,1 FROM generate_series(2,31) g`);
    await client.query(`INSERT INTO spares_history SELECT g,'s'||g,'v1','2026-10-26 21:00:00'::timestamp+g*interval '1 second',
      CASE WHEN g=41 THEN '01-Jan-2020' WHEN g=40 THEN 'not-a-date' ELSE '2026-10-26' END,
      'SP-'||lpad(g::text,3,'0'),'Part '||g,'Engine',CASE WHEN g%2=0 THEN 'RECEIVE' ELSE 'CONSUME' END,1,g,'ref'
      FROM generate_series(1,41) g`);
    await tenantStorage.run({ tuid: "spares-test", db: drizzle(client), pool }, async () => {
      const q = (extra: Record<string, any> = {}) => sparePageQuery.parse(extra);
      await t.test("validation, bounds and deterministic pages over >3 pages", async () => {
        for (const value of [{ page: 0 }, { pageSize: 201 }, { dateFrom: "2026-02-31" }, { kind: "invalid" }])
          assert.throws(() => q(value));
        const first = await queryPage("v1", q());
        assert.equal(first.total, 42); assert.equal(first.items.length, 10); assert.equal(first.totalPages, 5);
        const all = [];
        for (let page = 1; page <= 5; page++) all.push(...(await queryPage("v1", q({ page }))).items);
        assert.equal(new Set(all.map(r => r.id)).size, 42);
        assert.deepEqual(all.slice(0, 3).map(r => r.partCode), ["SP-001", "SP-002", "SP-003"]);
      });
      await t.test("full-scope search, header filters/values, numeric sort, SQL injection rejection", async () => {
        assert.equal((await queryPage("v1", q({ search: "LAST" }))).total, 1);
        assert.equal((await queryPage("v1", q({ kind: "bulk", search: "literal%_\\" }))).total, 1);
        assert.equal((await queryPage("v1", q({ search: "literal%_" }))).total, 1);
        const filters = JSON.stringify({ partCode: { filterType: "set", values: ["SP-041"] } });
        assert.equal((await queryPage("v1", q({ filters }))).total, 2);
        assert.ok((await queryValues("v1", q({ filters }), "partCode")).includes("SP-040"));
        assert.equal((await queryPage("v1", q({ sort: JSON.stringify([{ colId: "rob", sort: "desc" }]) }))).items[0].id, 41);
        await assert.rejects(queryPage("v1", q({ filters: '{"id;DROP TABLE spares":{}}' })), /Unsupported/);
        await assert.rejects(queryPage("v1", q({ sort: '[{"colId":"id","sort":"desc;DROP TABLE spares"}]' })));
      });
      await t.test("dotted descendants, linked components and stock calculations", async () => {
        assert.equal((await queryPage("v1", q({ componentId: "6.1" }))).total, 40);
        assert.equal((await queryPage("v1", q({ componentId: "8" }))).items[0].id, 41);
        assert.equal((await queryPage("v1", q({ stockStatus: "At Min" }))).items[0].id, 5);
        assert.equal((await queryPage("v1", q({ stockStatus: "Low" }))).total, 5);
        assert.equal((await queryPage("v1", q({ criticality: "Critical" }))).total, 20);
      });
      await t.test("independent location names/counts/pages and full location item scope", async () => {
        const nav = await queryLocations("v1", q({ page: 2, pageSize: 25 }));
        assert.equal(nav.total, 31); assert.equal(nav.items.length, 6); assert.equal(nav.items[0].locationName, "Location 026");
        assert.equal((await queryLocations("v1", q({ locationSearch: "031" }))).items[0].sparesCount, 1);
        const page = await queryPage("v1", q({ kind: "location", locationId: 1, page: 5 }));
        assert.equal(page.total, 41); assert.equal(page.items[0].locationQty, 41);
        assert.equal((await queryPage("v1", q({ kind: "location", locationId: 1, search: "LAST" }))).total, 1);
      });
      await t.test("History timestamp order, original search/event/date semantics and timezone fallback", async () => {
        const history = q({ kind: "history" });
        assert.equal((await queryPage("v1", history)).items[0].id, 41);
        assert.match((await queryPage("v1", history)).items[0].timestampUTC, /Z$/);
        assert.equal((await queryPage("v1", q({ kind: "history", eventType: "RECEIVE" }))).total, 20);
        assert.equal((await queryPage("v1", q({ kind: "history", dateFrom: "2020-01-01", dateTo: "2020-01-01" }))).total, 1);
        assert.equal((await queryPage("v1", q({ kind: "history", timeZone: "Asia/Kolkata", dateFrom: "2026-10-27", dateTo: "2026-10-27" }))).total, 1);
      });
      await t.test("My/Ship scope intersects trusted active assignments and fails closed", async () => {
        const req: any = { user: { userUuid: "user" }, rbac: { userType: "Ship" }, params: { vesselId: "all" } };
        const resolved = await resolveSparesScope(req, q({ scope: "my", vesselIds: "v1,v2,v3" }));
        assert.equal(resolved.vesselIds, "v1");
        const exportQuery = await parse({ ...req, query: { kind: "history", activeOnly: "false" } }, "inventory");
        assert.equal(exportQuery.kind, "inventory"); assert.equal(exportQuery.activeOnly, "true");
        assert.equal((await queryPage("all", resolved)).total, 42);
        const empty = await resolveSparesScope({ ...req, user: { userUuid: "nobody" } }, q({ scope: "my" }));
        assert.equal((await queryPage("all", empty)).total, 0);
        assert.equal((await queryPage("all", q({ vesselIds: "" }))).total, 0);
        await assert.rejects(resolveSparesScope({ ...req, params: { vesselId: "v2" } }, q()), /not assigned/);
        const mutation = { ...req, query: { paged: "true", scope: "my", vesselIds: "v1,v2" }, body: { vesselId: "all", rows: [{ componentSpareId: 1 }] } };
        await validatePagedBulk(mutation);
        await assert.rejects(validatePagedBulk({ ...mutation, body: { vesselId: "all", rows: [{ componentSpareId: 42 }] } }), /outside/);
        await assert.rejects(validatePagedBulk({ ...mutation, body: { vesselId: "all", rows: [{ componentSpareId: 1 }, { componentSpareId: "s1" }] } }), /Duplicate/);
        await assert.rejects(queryPage("all", q({ kind: "location", locationId: 1 })), /select one vessel/);
        await assert.rejects(queryLocations("all", q()), /select one vessel/);
      });
      await t.test("History display uses dateLocal ISO offsets without changing period-filter fallback", async () => {
        await client.query("UPDATE spares_history SET date_local='2026-10-25T22:30:00Z' WHERE id=39");
        const values = await queryValues("v1", q({ kind: "history", timeZone: "Asia/Kolkata" }), "date");
        assert.ok(values.includes("26-Oct-2026"));
        assert.equal((await queryPage("v1", q({ kind: "history", timeZone: "Asia/Kolkata", dateFrom: "2026-10-27", dateTo: "2026-10-27" }))).total, 2);
        await client.query("UPDATE spares_history SET date_local='2026-10-26' WHERE id=39");
      });
      await t.test("server exports are complete, preserve template/dedup/primary/linked metadata and History", async () => {
        for (const type of ["unique", "component", "history"] as const) {
          const filename = path.join(directory, `${type}.xlsx`);
          const result = await writeSpareExport(filename, "v1", q({ kind: type === "history" ? "history" : "inventory", pageSize: 10 }), type);
          const book = new ExcelJS.Workbook(); await book.xlsx.readFile(filename);
          const sheet = book.getWorksheet(type === "history" ? "Spares History" : "Spares")!;
          assert.equal(sheet.rowCount - 1, type === "unique" ? 41 : type === "component" ? 1 : 41);
          if (type !== "history") {
            assert.equal(sheet.getCell("AC1").value, "_TEMPLATE_VERSION_2.0.0");
            assert.equal(sheet.getCell("E2").value, type === "unique" ? "6.1.1" : "8.2");
            assert.equal(book.getWorksheet("Components")!.rowCount, 3);
            assert.equal(sheet.getCell("I2").dataValidation.type, "list");
          }
          if (type === "component") assert.equal(result.excluded, 1);
        }
      });
      await t.test("component export rejects inconsistent UUID instead of substituting numeric ID", async () => {
        await client.query(`INSERT INTO spare_component_links VALUES (3,'v1','wrong-uuid',1,'c1',false)`);
        await assert.rejects(writeSpareExport(path.join(directory, "bad.xlsx"), "v1", q(), "component"), /inconsistent identity/);
      });
    });
  } finally {
    await client.query("DISCARD TEMP"); client.release();
    await rm(directory, { recursive: true, force: true }); await pool.end();
  }
});
