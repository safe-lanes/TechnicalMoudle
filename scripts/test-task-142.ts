import { generateProvisioningBundle } from "/home/runner/workspace/server/modules/sync/provisioningService";
import { Pool } from "pg";

const VESSEL = "744535d0-841a-11ed-aa7c-7003bca91a86";
const TAG = "TASK142_TEST";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const cs = await pool.query(
    `SELECT cuuid FROM components WHERE vessel_id=$1 AND COALESCE(is_deleted,false)=false LIMIT 2`,
    [VESSEL]
  );
  const js = await pool.query(
    `SELECT juuid FROM jobs WHERE vessel_id=$1 AND COALESCE(is_deleted,false)=false LIMIT 1`,
    [VESSEL]
  );
  const compValid = cs.rows[0].cuuid;
  const compOrphan = cs.rows[1].cuuid;
  const jobId = js.rows[0].juuid;
  console.log(`Picked compValid=${compValid} compOrphan=${compOrphan} jobId=${jobId}`);

  const pdValid = `${TAG}_VALID_${Date.now()}`;
  const pdOrphan = `${TAG}_ORPHAN_${Date.now()}`;
  await pool.query(
    `INSERT INTO planner_dates (pduuid, vessel_id, job_id, component_id, planned_date, is_deleted, is_sync, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'2026-12-01',false,false,NOW(),NOW()),
            ($5,$2,$3,$6,'2026-12-15',false,false,NOW(),NOW())`,
    [pdValid, VESSEL, jobId, compValid, pdOrphan, compOrphan]
  );
  console.log(`Seeded planner_dates valid=${pdValid} orphan=${pdOrphan}`);

  await pool.query(
    `UPDATE components SET is_deleted=true, updated_at=NOW() WHERE cuuid=$1`,
    [compOrphan]
  );
  console.log(`Soft-deleted component ${compOrphan}`);

  try {
    const bundle = await generateProvisioningBundle(VESSEL, "task-142-test");
    const pdEntry = bundle.data.find((d: any) => d.tableName === "planner_dates");
    const pdManifest = bundle.manifest.tables.find((t: any) => t.tableName === "planner_dates");
    console.log("\n=== RESULTS ===");
    console.log("planner_dates exported rows:", pdEntry?.rows.length);
    console.log("planner_dates pduuid list:", pdEntry?.rows.map((r: any) => r.pduuid));
    console.log("manifest entry:", JSON.stringify(pdManifest));

    const exported = new Set((pdEntry?.rows || []).map((r: any) => r.pduuid));
    const test1 = exported.has(pdValid) && !exported.has(pdOrphan);
    console.log(test1 ? "\n✅ TEST 1 PASS: valid exported, orphan excluded" : "\n❌ TEST 1 FAIL");
    const test2 = pdManifest?.category?.includes("orphan");
    console.log(test2 ? "✅ TEST 2 PASS: manifest mentions orphan-skip" : "❌ TEST 2 FAIL");

    const compSet = new Set(
      (bundle.data.find((d: any) => d.tableName === "components")?.rows || []).map((r: any) => r.cuuid)
    );
    const danglers = (pdEntry?.rows || []).filter((r: any) => !compSet.has(r.component_id));
    console.log(danglers.length === 0
      ? "✅ TEST 3 PASS: bundle is referentially consistent (no danglers)"
      : `❌ TEST 3 FAIL: ${danglers.length} danglers`);
  } finally {
    await pool.query(`DELETE FROM planner_dates WHERE pduuid IN ($1, $2)`, [pdValid, pdOrphan]);
    await pool.query(`UPDATE components SET is_deleted=false, updated_at=NOW() WHERE cuuid=$1`, [compOrphan]);
    console.log("\nCleanup done");
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
