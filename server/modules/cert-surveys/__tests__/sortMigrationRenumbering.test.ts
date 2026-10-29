import fs from "node:fs";
import { createHash } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { Pool, PoolClient } from "pg";
import { getPool } from "../../../db";
import { getPendingMigrations, runDrizzleMigrations } from "../../../migrations";

const migrations = [
  { old: "185_certificate_natural_sort", next: "188_certificate_natural_sort", hash: "fec88a821f15be7122325598b9b35dbf393a65f4003db70abc24bad963253de6" },
  { old: "186_survey_default_sort", next: "189_survey_default_sort", hash: "25007a0ff158a79296efe57f8a5da3b134f74488eee6bbec630ff60c564b8022" },
];

describe("Renumbered sorting migrations", () => {
  let pool: Pool;
  let client: PoolClient;
  beforeAll(async () => { pool = await getPool(); client = await pool.connect(); });
  afterAll(async () => { client?.release(); await pool?.end(); });

  it("keeps the original SQL bytes and removes only the superseded filenames", () => {
    for (const migration of migrations) {
      expect(fs.existsSync(`migrations/${migration.old}.sql`)).toBe(false);
      const content = fs.readFileSync(`migrations/${migration.next}.sql`);
      expect(createHash("sha256").update(content).digest("hex")).toBe(migration.hash);
    }
    const files = fs.readdirSync("migrations");
    expect(files.filter(file => /^(188|189)_.*\.sql$/.test(file))).toEqual(migrations.map(m => `${m.next}.sql`));
    expect(files).not.toContain("184_stores_operation_targets.sql");
    expect(files).not.toContain("187_defect_log_matching.sql");
  });

  it.each(["fresh", "upgrade"])("discovers, applies and records the new IDs safely on %s history", async installation => {
    await client.query("BEGIN");
    try {
      // Every history row is test-local. Collation DDL is transactional and
      // rolled back; no real migration history or application data is changed.
      await client.query(`CREATE TEMP TABLE schema_migrations(
        id varchar(255) PRIMARY KEY,name varchar(255) NOT NULL,description text,applied_at timestamp DEFAULT now()
      ) ON COMMIT DROP`);
      const scopedPool = { query: client.query.bind(client) } as unknown as Pool;
      const fresh = await getPendingMigrations(scopedPool);
      expect(fresh.filter(id => migrations.some(m => m.next === id))).toEqual(migrations.map(m => m.next));
      expect(fresh.some(id => migrations.some(m => m.old === id))).toBe(false);

      // Seed unrelated files as complete in this fixture so the real file
      // runner can execute only the requested pair, never unrelated SQL.
      const unrelated = fs.readdirSync("migrations").filter(file => file.endsWith(".sql"))
        .map(file => file.slice(0, -4)).filter(id => !migrations.some(m => m.next === id));
      await client.query(`INSERT INTO schema_migrations(id,name) SELECT id,'Unrelated fixture' FROM unnest($1::text[]) AS id`, [unrelated]);
      if (installation === "upgrade") {
        for (const migration of migrations) {
          await client.query(fs.readFileSync(`migrations/${migration.next}.sql`, "utf8"));
          await client.query(`INSERT INTO schema_migrations(id,name,description,applied_at)
            VALUES($1,'Original installation','Preserve original history','2026-01-01')`, [migration.old]);
        }
      }
      const oldHistory = (await client.query(`SELECT * FROM schema_migrations WHERE id=ANY($1::text[]) ORDER BY id`, [migrations.map(m => m.old)])).rows;
      expect((await runDrizzleMigrations(scopedPool)).applied).toBe(2);
      expect((await getPendingMigrations(scopedPool)).some(id => migrations.some(m => m.next === id || m.old === id))).toBe(false);
      const newHistory = (await client.query(`SELECT id,name FROM schema_migrations WHERE id=ANY($1::text[]) ORDER BY id`, [migrations.map(m => m.next)])).rows;
      expect(newHistory).toEqual(migrations.map(m => ({ id: m.next, name: `Drizzle SQL migration: ${m.next}.sql` })));
      expect((await client.query(`SELECT * FROM schema_migrations WHERE id=ANY($1::text[]) ORDER BY id`, [migrations.map(m => m.old)])).rows).toEqual(oldHistory);
      expect((await runDrizzleMigrations(scopedPool)).applied).toBe(0);
    } finally { await client.query("ROLLBACK"); }
  }, 30000);
});
