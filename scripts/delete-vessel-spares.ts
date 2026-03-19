import { pool } from '../server/db';

const VESSEL_ID = process.argv[2];

if (!VESSEL_ID) {
  console.error('Usage: npx tsx scripts/delete-vessel-spares.ts <vessel_uuid>');
  console.error('Example: npx tsx scripts/delete-vessel-spares.ts f6212312-3486-43de-b37b-640a1f14bc75');
  process.exit(1);
}

async function deleteVesselSpares(vesselId: string) {
  if (!pool) {
    throw new Error('Database pool not available — DATABASE_URL not configured');
  }
  const client = await pool.connect();

  try {
    const vessel = await client.query(
      'SELECT vuuid, name, code FROM vessels WHERE vuuid = $1',
      [vesselId],
    );
    if (vessel.rows.length === 0) {
      throw new Error(`Vessel ${vesselId} not found`);
    }
    const vName = vessel.rows[0].name;
    const vCode = vessel.rows[0].code;

    console.log(`=== Delete Spares Data for ${vName} (${vCode}) ===`);
    console.log('Vessel ID:', vesselId);
    console.log('');

    const sparesCount = await client.query('SELECT COUNT(*) as cnt FROM spares WHERE vessel_id = $1', [vesselId]);
    const linksCount = await client.query('SELECT COUNT(*) as cnt FROM spare_component_links WHERE vessel_id = $1', [vesselId]);
    const stockCount = await client.query('SELECT COUNT(*) as cnt FROM spare_location_stock WHERE vessel_id = $1', [vesselId]);
    const histCount = await client.query('SELECT COUNT(*) as cnt FROM spares_history WHERE vessel_id = $1', [vesselId]);
    const txnCount = await client.query('SELECT COUNT(*) as cnt FROM inventory_transactions WHERE vessel_id = $1', [vesselId]);

    console.log('BEFORE:');
    console.log('  Spares:', sparesCount.rows[0].cnt);
    console.log('  Spare component links:', linksCount.rows[0].cnt);
    console.log('  Spare location stock:', stockCount.rows[0].cnt);
    console.log('  Spares history:', histCount.rows[0].cnt);
    console.log('  Inventory transactions:', txnCount.rows[0].cnt);
    console.log('');

    await client.query('BEGIN');

    const del1 = await client.query('DELETE FROM inventory_transactions WHERE vessel_id = $1', [vesselId]);
    console.log('Deleted inventory_transactions:', del1.rowCount);

    const del2 = await client.query('DELETE FROM spare_location_stock WHERE vessel_id = $1', [vesselId]);
    console.log('Deleted spare_location_stock:', del2.rowCount);

    const del3 = await client.query('DELETE FROM spare_component_links WHERE vessel_id = $1', [vesselId]);
    console.log('Deleted spare_component_links:', del3.rowCount);

    const del4 = await client.query('DELETE FROM spares_history WHERE vessel_id = $1', [vesselId]);
    console.log('Deleted spares_history:', del4.rowCount);

    const del5 = await client.query('DELETE FROM spares WHERE vessel_id = $1', [vesselId]);
    console.log('Deleted spares:', del5.rowCount);

    await client.query('COMMIT');
    console.log('');

    const afterSpares = await client.query('SELECT COUNT(*) as cnt FROM spares WHERE vessel_id = $1', [vesselId]);
    const afterLinks = await client.query('SELECT COUNT(*) as cnt FROM spare_component_links WHERE vessel_id = $1', [vesselId]);
    const afterStock = await client.query('SELECT COUNT(*) as cnt FROM spare_location_stock WHERE vessel_id = $1', [vesselId]);

    console.log('AFTER:');
    console.log('  Spares:', afterSpares.rows[0].cnt);
    console.log('  Spare component links:', afterLinks.rows[0].cnt);
    console.log('  Spare location stock:', afterStock.rows[0].cnt);
    console.log('');

    const compCount = await client.query('SELECT COUNT(*) as cnt FROM components WHERE vessel_id = $1', [vesselId]);
    console.log('Vessel still exists: YES');
    console.log('Components still intact:', compCount.rows[0].cnt);

    const otherVessels = await client.query(`
      SELECT v.name, COUNT(s.id) as spare_count
      FROM vessels v
      LEFT JOIN spares s ON s.vessel_id = v.vuuid
      GROUP BY v.name
      ORDER BY spare_count DESC
      LIMIT 12
    `);
    console.log('');
    console.log('All vessels spare counts (cross-check):');
    otherVessels.rows.forEach((r: any) => console.log('  ', r.name, ':', r.spare_count));

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

deleteVesselSpares(VESSEL_ID).catch(console.error);
