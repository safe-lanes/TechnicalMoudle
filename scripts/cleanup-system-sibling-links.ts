import { getPool } from '../server/db';

async function cleanupSystemSiblingLinks() {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    console.log('=== Spare Component Link Cleanup: Remove bloated "System" sibling links ===\n');

    const beforeTotal = await client.query('SELECT COUNT(*) as total FROM spare_component_links');
    const systemLinks = await client.query("SELECT COUNT(*) as total FROM spare_component_links WHERE linked_by = 'System'");
    const nonSystemLinks = await client.query("SELECT COUNT(*) as total FROM spare_component_links WHERE linked_by != 'System' OR linked_by IS NULL");

    console.log('BEFORE CLEANUP:');
    console.log('  Total links:', beforeTotal.rows[0].total);
    console.log('  System links (to delete):', systemLinks.rows[0].total);
    console.log('  Non-System links (to keep):', nonSystemLinks.rows[0].total);

    const breakdown = await client.query("SELECT linked_by, COUNT(*) as cnt FROM spare_component_links GROUP BY linked_by ORDER BY cnt DESC");
    console.log('\n  Breakdown by linked_by:');
    breakdown.rows.forEach((r: any) => console.log('   ', r.linked_by, ':', r.cnt));

    if (parseInt(systemLinks.rows[0].total) === 0) {
      console.log('\nNo "System" links found — nothing to clean up.');
      return;
    }

    const deleteResult = await client.query("DELETE FROM spare_component_links WHERE linked_by = 'System'");
    console.log('\n=== DELETED', deleteResult.rowCount, '"System" links ===');

    const afterTotal = await client.query('SELECT COUNT(*) as total FROM spare_component_links');
    const afterBreakdown = await client.query("SELECT linked_by, COUNT(*) as cnt FROM spare_component_links GROUP BY linked_by ORDER BY cnt DESC");
    console.log('\nAFTER CLEANUP:');
    console.log('  Total links remaining:', afterTotal.rows[0].total);
    console.log('  Breakdown:');
    afterBreakdown.rows.forEach((r: any) => console.log('   ', r.linked_by, ':', r.cnt));

    const orphans = await client.query(`
      SELECT COUNT(*) as cnt FROM spare_component_links scl
      WHERE NOT EXISTS (SELECT 1 FROM spares s WHERE s.id = scl.spare_id)
    `);
    console.log('\nPOST-CLEANUP VALIDATION:');
    console.log('  Orphaned links (no matching spare):', orphans.rows[0].cnt);

    const dupes = await client.query(`
      SELECT spare_id, component_id, vessel_id, COUNT(*) as cnt
      FROM spare_component_links
      GROUP BY spare_id, component_id, vessel_id
      HAVING COUNT(*) > 1
    `);
    console.log('  Duplicate (spareId, componentId, vesselId) tuples:', dupes.rows.length);

    const perVessel = await client.query(`
      SELECT v.name as vessel_name, scl.vessel_id, COUNT(*) as link_count
      FROM spare_component_links scl
      LEFT JOIN vessels v ON v.vuuid = scl.vessel_id
      GROUP BY v.name, scl.vessel_id
      ORDER BY link_count DESC
    `);
    console.log('\n  Links per vessel:');
    perVessel.rows.forEach((r: any) => console.log('   ', r.vessel_name || r.vessel_id, ':', r.link_count));

  } finally {
    client.release();
    await pool.end();
  }
}

cleanupSystemSiblingLinks().catch(console.error);
