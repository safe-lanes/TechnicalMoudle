/** Read-only query-plan/payload evidence against available DEVELOPMENT data. */
import { sql } from "drizzle-orm";
import { getDb, getPool } from "../../server/db";
import { sparePageQuery } from "../../shared/sparesPagination";
import { criteria, from, ordering, queryPage } from "../../server/modules/spares/repositories/sparesPagingRepository";

const db = await getDb(), pool = await getPool();
try {
  const largest = await db.execute(sql`SELECT vessel_id,count(*)::int AS total FROM spares
    WHERE deleted=false AND is_deleted IS DISTINCT FROM TRUE AND data_scope='vessel' AND vessel_id IS NOT NULL
    GROUP BY vessel_id ORDER BY count(*) DESC LIMIT 1`);
  if (!largest.rows.length) throw new Error("No development inventory is available for read-only plan evidence");
  const vessel = String(largest.rows[0].vessel_id);
  for (const kind of ["inventory", "bulk", "history"] as const) {
    const q = sparePageQuery.parse({ kind, pageSize: kind === "bulk" ? 25 : 10 });
    const result = await db.execute(sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT s.* FROM ${from(q)}
      WHERE ${criteria(vessel, q)} ORDER BY ${ordering(q)} LIMIT ${q.pageSize}`);
    const document = result.rows[0]["QUERY PLAN"] as any;
    const plan = (typeof document === "string" ? JSON.parse(document) : document)[0];
    const page = await queryPage(vessel, q);
    console.log(JSON.stringify({ kind, total: page.total, items: page.items.length, jsonBytes: Buffer.byteLength(JSON.stringify(page)),
      executionMs: plan["Execution Time"], rootNode: plan.Plan["Node Type"], plan: plan.Plan }, null, 2));
  }
} finally { await pool.end(); }
