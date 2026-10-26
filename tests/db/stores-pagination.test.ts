/**
 * Runs against isolated TEMP tables on one connection; never modifies user data.
 * node --import tsx --test tests/db/stores-pagination.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { getPool } from "../../server/db";
import { tenantStorage } from "../../server/utils/asyncLocalStorage";
import { storePageQuery } from "../../shared/storesPagination";
import { queryPage, queryLocations, queryValues, queryTargets } from "../../server/modules/stores/repositories/storesPagingRepository";
import { resolveStoresScope } from "../../server/modules/stores/repositories/storesPagingScope";

test("Stores SQL pagination and full-dataset operations", async t => {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query(`CREATE TEMP TABLE stores_items (
      id int PRIMARY KEY,stuuid text,vessel_id text,item_type text,item_code text,item_name text,
      category text,uom text,rob numeric,rob_location_a numeric,rob_location_b numeric,
      min numeric,max numeric,location_a text,location_b text,deleted boolean,is_active boolean,
      expiry_date text,batch_number text,hazard_classification text,ihm_presence text
    )`);
    await client.query(`CREATE TEMP TABLE stores_ledger (
      id int PRIMARY KEY,store_uuid text,vessel_id text,section text,item_id int,item_name text,
      part_code text,event_type text,date_local text,timestamp_utc timestamp,
      qty_change_base numeric,rob_after_base numeric,uom text,place text,user_id text,remarks text,ref text
    )`);
    await client.query(`CREATE TEMP TABLE master_user_vessels (user_uuid text,vessel_id text,is_active boolean)`);
    await client.query(`INSERT INTO master_user_vessels VALUES ('user','v1',true),('user','v2',false)`);
    // >3 pages, all four tabs, identical search matches across vessels.
    for (const [index, tab] of ["stores", "lubes", "chemicals", "others"].entries()) {
      await client.query(`INSERT INTO stores_items
        SELECT $1::int+g,($1::int+g)::text,'v1',$2::text,g::text,
          CASE WHEN g=81 THEN 'LAST Literal%_\\ Item' ELSE 'Item '||g END,
          CASE WHEN g%2=0 THEN 'General Tools' ELSE 'Engine Stores' END,'pcs',
          CASE WHEN g=1 THEN 0 ELSE g END,2,3,5,100,
          CASE WHEN g=81 THEN 'Hidden Bay' ELSE 'Bay' END,'Bay',false,g<>80,
          '2027-01-01','batch','Flammable','Unknown'
        FROM generate_series(1,81) g`, [index * 1000, tab]);
      await client.query(`INSERT INTO stores_items VALUES
        ($1,'other','v2',$2,'81','LAST Literal%_\\ Item','Engine Stores','pcs',100,50,50,5,100,'Other Vessel','Bay',false,true,'','','','')`,
        [index * 1000 + 82, tab]);
    }
    await client.query(`INSERT INTO stores_items VALUES
      (9999,'deleted','v1','stores','0','Deleted','Engine Stores','pcs',1,1,0,0,1,'Bay','Bay',true,true,'','','','')`);
    await client.query(`INSERT INTO stores_ledger
      SELECT g,g::text,'v1','stores',g,CASE WHEN g=82 THEN 'Historical Name' ELSE 'Item '||g END,
      g::text,CASE WHEN g%2=0 THEN 'RECEIVE' ELSE 'CONSUME' END,
      CASE WHEN g=82 THEN '01-Jan-2020' WHEN g=81 THEN 'not-a-date' ELSE '2026-10-26' END,
      '2026-10-26 21:00:00'::timestamp,1,g,'pcs','','','remark','ref' FROM generate_series(1,82) g`);
    const db = drizzle(client);
    await tenantStorage.run({ tuid: "stores-test", db, pool }, async () => {
      const q = (extra = {}) => storePageQuery.parse({ itemType: "stores", ...extra });
      for (const tab of ["stores", "lubes", "chemicals", "others"]) {
        await t.test(`${tab}: bounds, natural order, full-scope literal search`, async () => {
          const first = await queryPage("v1", q({ itemType: tab }));
          assert.equal(first.total, 81); assert.equal(first.items.length, 25); assert.equal(first.totalPages, 4);
          assert.deepEqual(first.items.slice(0, 10).map(i => i.itemCode), Array.from({ length: 10 }, (_, i) => String(i + 1)));
          const last = await queryPage("v1", q({ itemType: tab, page: 4 }));
          assert.equal(last.items.length, 6);
          assert.equal((await queryPage("v1", q({ itemType: tab, search: "literal%_\\" }))).total, 1);
          assert.equal((await queryPage("v1", q({ itemType: tab, search: "no matches" }))).total, 0);
          assert.equal((await queryPage("v1", q({ itemType: tab, activeOnly: "true" }))).total, 80);
          const filtered = await queryPage("v1", q({ itemType: tab, category: "General", stockStatus: "OK" }));
          assert.equal(filtered.total, 38); // even 2 and 4 are below min; 80 is still eligible
          const grid = await queryPage("v1", q({ itemType: tab, filters: JSON.stringify({ itemName: { filterType: "text", type: "contains", filter: "LAST" } }) }));
          assert.equal(grid.total, 1); assert.match(grid.items[0].itemName, /^LAST/);
          const sorted = await queryPage("v1", q({ itemType: tab, sort: JSON.stringify([{ colId: "itemName", sort: "desc" }]) }));
          assert.match(sorted.items[0].itemName, /^LAST/);
          const options = await queryValues("v1", q({ itemType: tab }), "locationAName", false);
          assert.deepEqual(options, ["Bay", "Hidden Bay"]);
          const targets = await queryTargets("v1", q({ itemType: tab, search: "item" }));
          assert.equal(targets.length, 81);
        });
      }
      await t.test("ROB nonzero fallback and zero minimum rules", async () => {
        const low = await queryPage("v1", q({ stockStatus: "Low" }));
        assert.deepEqual(low.items.map(i => i.id), [2, 3, 4]);
        await client.query("UPDATE stores_items SET min=0 WHERE id=1");
        assert.equal((await queryPage("v1", q({ stockStatus: "N/A" }))).total, 1);
      });
      await t.test("Location names/counts/pages match positive-side behavior", async () => {
        const locs = await queryLocations("v1", q({ pageSize: 1, locationSearch: "Hidden" }));
        assert.deepEqual(locs.items, [{ name: "Hidden Bay", count: 1 }]);
        const bay = await queryLocations("v1", q({ locationSearch: "Bay" }));
        assert.equal(bay.items.find(i => i.name === "Bay").count, 161);
        const locItems = await queryPage("v1", q({ location: "Hidden Bay" }));
        assert.equal(locItems.total, 1); assert.equal(locItems.items[0].id, 81);
      });
      await t.test("History uses id order, snapshot search, local day, all-page filters", async () => {
        const history = await queryPage("v1", q(), true);
        assert.equal(history.total, 82); assert.equal(history.items[0].id, 82);
        assert.ok(!Number.isNaN(new Date(history.items[0].timestampUTC).getTime()));
        assert.match(String(history.items[0].timestampUTC), /Z$/);
        assert.equal((await queryPage("v1", q({ search: "Historical" }), true)).total, 1);
        const filtered = await queryPage("v1", q({ eventType: "RECEIVE", dateFrom: "2026-10-26", dateTo: "2026-10-26" }), true);
        assert.equal(filtered.total, 40);
        const tz = await queryPage("v1", q({ search: "Item 81", dateFrom: "2026-10-27", timeZone: "Asia/Kolkata" }), true);
        assert.equal(tz.total, 1);
        const value = await queryValues("v1", q(), "dateLocal", true);
        assert.ok(value.includes("01-Jan-2020"));
        const model = { dateLocal: { filterType: "set", values: ["01-Jan-2020"] } };
        assert.equal((await queryPage("v1", q({ filters: JSON.stringify(model) }), true)).total, 1);
      });
      await t.test("Fleet scope, explicit empty list, trusted assignments", async () => {
        assert.equal((await queryPage("all", q({ scope: "my", vesselIds: "" }))).total, 0);
        assert.equal((await queryPage("all", q({ vesselIds: "v1" }))).total, 81);
        assert.equal((await queryPage("all", q())).total, 82);
        const req: any = { params: { vesselId: "all" }, user: { userUuid: "user" }, rbac: { userType: "Office" } };
        const scope = await resolveStoresScope(req, q({ scope: "my", vesselIds: "v1,v2" }));
        assert.equal(scope.vesselIds, "v1");
        req.rbac.userType = "Ship"; req.params.vesselId = "v2";
        await assert.rejects(resolveStoresScope(req, q()), /not assigned/);
      });
      await t.test("Invalid inputs/columns rejected instead of interpolated", async () => {
        for (const bad of [{ page: 0 }, { pageSize: 201 }, { itemType: "lubricants" }, { dateFrom: "2026-02-31" }, { dateFrom: "2026-11-01", dateTo: "2026-10-01" }])
          assert.equal(storePageQuery.safeParse({ itemType: "stores", ...bad }).success, false);
        await assert.rejects(queryPage("v1", q({ sort: '[{"colId":"id;DROP TABLE stores_items","sort":"asc"}]' })), /Unsupported/);
      });
    });
  } finally {
    await client.query("DROP TABLE IF EXISTS pg_temp.stores_ledger,pg_temp.stores_items,pg_temp.master_user_vessels");
    client.release(); await pool.end();
  }
});
