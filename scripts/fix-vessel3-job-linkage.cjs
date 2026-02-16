const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('=== Fix Vessel 3 UWO Job Linkage ===\n');

    const initialCount = await pool.query(
      `SELECT COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 AND job_id IS NULL AND work_order_no LIKE 'UWO-%'`,
      [VESSEL_ID]
    );
    console.log(`Total unlinked UWO work orders: ${initialCount.rows[0].cnt}\n`);

    // Strategy 1: Exact component_code match
    console.log('--- Strategy 1: Exact component_code match ---');
    const s1 = await pool.query(`
      UPDATE work_orders wo
      SET job_id = (
        SELECT j.id FROM jobs j 
        WHERE j.vessel_id = wo.vessel_id 
        AND j.component_code = wo.component_code
        ORDER BY j.id LIMIT 1
      )
      WHERE wo.vessel_id = $1
      AND wo.job_id IS NULL
      AND work_order_no LIKE 'UWO-%'
      AND EXISTS (
        SELECT 1 FROM jobs j WHERE j.vessel_id = wo.vessel_id AND j.component_code = wo.component_code
      )
    `, [VESSEL_ID]);
    console.log(`Strategy 1 linked: ${s1.rowCount} work orders\n`);

    // Check remaining
    const after1 = await pool.query(
      `SELECT COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 AND job_id IS NULL AND work_order_no LIKE 'UWO-%'`,
      [VESSEL_ID]
    );
    console.log(`Remaining unlinked after Strategy 1: ${after1.rows[0].cnt}\n`);

    // Strategy 2: Match by first two parts of component_code (e.g., '652.004.01' -> '652.004')
    console.log('--- Strategy 2: Match by first two parts of component_code ---');
    const s2 = await pool.query(`
      UPDATE work_orders wo
      SET job_id = (
        SELECT j.id FROM jobs j 
        WHERE j.vessel_id = wo.vessel_id 
        AND j.component_code = SPLIT_PART(wo.component_code, '.', 1) || '.' || SPLIT_PART(wo.component_code, '.', 2)
        ORDER BY j.id LIMIT 1
      )
      WHERE wo.vessel_id = $1
      AND wo.job_id IS NULL
      AND work_order_no LIKE 'UWO-%'
      AND EXISTS (
        SELECT 1 FROM jobs j 
        WHERE j.vessel_id = wo.vessel_id 
        AND j.component_code = SPLIT_PART(wo.component_code, '.', 1) || '.' || SPLIT_PART(wo.component_code, '.', 2)
      )
    `, [VESSEL_ID]);
    console.log(`Strategy 2 linked: ${s2.rowCount} work orders\n`);

    const after2 = await pool.query(
      `SELECT COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 AND job_id IS NULL AND work_order_no LIKE 'UWO-%'`,
      [VESSEL_ID]
    );
    console.log(`Remaining unlinked after Strategy 2: ${after2.rows[0].cnt}\n`);

    // Strategy 3: Match by jobs whose component_code starts with the first two parts
    console.log('--- Strategy 3: Match jobs with component_code starting with first two parts ---');
    const s3 = await pool.query(`
      UPDATE work_orders wo
      SET job_id = (
        SELECT j.id FROM jobs j 
        WHERE j.vessel_id = wo.vessel_id 
        AND j.component_code LIKE (SPLIT_PART(wo.component_code, '.', 1) || '.' || SPLIT_PART(wo.component_code, '.', 2) || '%')
        ORDER BY j.id LIMIT 1
      )
      WHERE wo.vessel_id = $1
      AND wo.job_id IS NULL
      AND work_order_no LIKE 'UWO-%'
      AND EXISTS (
        SELECT 1 FROM jobs j 
        WHERE j.vessel_id = wo.vessel_id 
        AND j.component_code LIKE (SPLIT_PART(wo.component_code, '.', 1) || '.' || SPLIT_PART(wo.component_code, '.', 2) || '%')
      )
    `, [VESSEL_ID]);
    console.log(`Strategy 3 linked: ${s3.rowCount} work orders\n`);

    const after3 = await pool.query(
      `SELECT COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 AND job_id IS NULL AND work_order_no LIKE 'UWO-%'`,
      [VESSEL_ID]
    );
    console.log(`Remaining unlinked after Strategy 3: ${after3.rows[0].cnt}\n`);

    // Strategy 4: Last resort - match by first SFI group code (first part before '.')
    console.log('--- Strategy 4: Match by first SFI group code ---');
    const s4 = await pool.query(`
      UPDATE work_orders wo
      SET job_id = (
        SELECT j.id FROM jobs j 
        WHERE j.vessel_id = wo.vessel_id 
        AND j.component_code LIKE (SPLIT_PART(wo.component_code, '.', 1) || '%')
        ORDER BY j.id LIMIT 1
      )
      WHERE wo.vessel_id = $1
      AND wo.job_id IS NULL
      AND work_order_no LIKE 'UWO-%'
      AND EXISTS (
        SELECT 1 FROM jobs j 
        WHERE j.vessel_id = wo.vessel_id 
        AND j.component_code LIKE (SPLIT_PART(wo.component_code, '.', 1) || '%')
      )
    `, [VESSEL_ID]);
    console.log(`Strategy 4 linked: ${s4.rowCount} work orders\n`);

    const after4 = await pool.query(
      `SELECT COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 AND job_id IS NULL AND work_order_no LIKE 'UWO-%'`,
      [VESSEL_ID]
    );
    console.log(`Remaining unlinked after Strategy 4: ${after4.rows[0].cnt}\n`);

    // Show any remaining unlinked
    if (parseInt(after4.rows[0].cnt) > 0) {
      const remaining = await pool.query(
        `SELECT work_order_no, component_code, component FROM work_orders WHERE vessel_id = $1 AND job_id IS NULL AND work_order_no LIKE 'UWO-%' ORDER BY component_code`,
        [VESSEL_ID]
      );
      console.log('Remaining unlinked work orders:');
      for (const row of remaining.rows) {
        console.log(`  ${row.work_order_no} | ${row.component_code} | ${row.component}`);
      }
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total UWO work orders initially unlinked: ${initialCount.rows[0].cnt}`);
    console.log(`Strategy 1 (exact component_code):       ${s1.rowCount} linked`);
    console.log(`Strategy 2 (first two parts exact):       ${s2.rowCount} linked`);
    console.log(`Strategy 3 (first two parts prefix):      ${s3.rowCount} linked`);
    console.log(`Strategy 4 (first SFI group):             ${s4.rowCount} linked`);
    const totalLinked = s1.rowCount + s2.rowCount + s3.rowCount + s4.rowCount;
    console.log(`Total linked:                             ${totalLinked}`);
    console.log(`Remaining unlinked:                       ${after4.rows[0].cnt}`);

    // Verification
    console.log('\n--- Verification ---');
    const verify = await pool.query(
      `SELECT 
        COUNT(*) as total_uwos,
        COUNT(job_id) as linked,
        COUNT(*) - COUNT(job_id) as unlinked
      FROM work_orders 
      WHERE vessel_id = $1 AND work_order_no LIKE 'UWO-%'`,
      [VESSEL_ID]
    );
    console.log(`Total UWO work orders: ${verify.rows[0].total_uwos}`);
    console.log(`Linked to jobs: ${verify.rows[0].linked}`);
    console.log(`Still unlinked: ${verify.rows[0].unlinked}`);

  } catch (err) {
    console.error('Fatal error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
