import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Check if id = uuid for each parent table
  const tables = [
    { name: 'vessels', id: 'id', uuid: 'vuuid' },
    { name: 'components', id: 'id', uuid: 'cuuid' },
    { name: 'jobs', id: 'id', uuid: 'juuid' },
    { name: 'work_orders', id: 'id', uuid: 'wouuid' },
    { name: 'spares', id: 'id', uuid: 'suuid' },
    { name: 'stores_items', id: 'id', uuid: 'stuuid' },
    { name: 'defects', id: 'id', uuid: 'duuid' },
  ];

  for (const t of tables) {
    const q = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "${t.id}"::text = "${t.uuid}"::text) as matching,
        COUNT(*) FILTER (WHERE "${t.id}"::text != "${t.uuid}"::text) as mismatched
      FROM ${t.name};
    `);
    const r = q.rows[0];
    console.log(`${t.name}: total=${r.total}, id=uuid: ${r.matching}, id!=uuid: ${r.mismatched}`);
    
    // Show a sample row
    const sample = await pool.query(`SELECT "${t.id}" as id, "${t.uuid}" as uuid FROM ${t.name} LIMIT 1`);
    if (sample.rows[0]) {
      console.log(`  Sample: id="${sample.rows[0].id}", uuid="${sample.rows[0].uuid}"`);
    }
  }

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
