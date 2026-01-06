import pg from 'pg';
const { Pool } = pg;

interface Spare {
  spare_id: string;
  part_number: string;
  part_name: string;
  uom: string;
}

interface Job {
  job_id: string;
  job_code: string;
  job_title: string;
  component_id: string;
}

interface RequiredSparePart {
  partNo: string;
  description: string;
  quantityRequired: string;
}

async function populateJobSpares() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Starting to populate job required spare parts...\n');

    // Get all jobs for components that have both jobs and spares in V015
    const jobsResult = await pool.query<Job>(`
      SELECT 
        j.id as job_id,
        j.job_no as job_code,
        j.job_title,
        j.component_id
      FROM jobs j
      INNER JOIN components c ON c.id = j.component_id
      WHERE j.vessel_id = 'V015'
        AND EXISTS (
          SELECT 1 FROM spare_component_links scl 
          WHERE scl.component_id = j.component_id
        )
      ORDER BY c.component_code, j.job_no
    `);

    console.log(`Found ${jobsResult.rows.length} jobs to update.\n`);

    let updatedCount = 0;

    for (const job of jobsResult.rows) {
      // Get spares linked to this job's component
      const sparesResult = await pool.query<Spare>(`
        SELECT 
          s.id as spare_id,
          COALESCE(s.part_number, s.part_code, '') as part_number,
          COALESCE(s.part_name, '') as part_name,
          COALESCE(s.uom, 'PCS') as uom
        FROM spare_component_links scl
        INNER JOIN spares s ON s.id = scl.spare_id
        WHERE scl.component_id = $1
        ORDER BY RANDOM()
        LIMIT 5
      `, [job.component_id]);

      if (sparesResult.rows.length === 0) {
        console.log(`  Skipping job ${job.job_code}: No spares linked to component`);
        continue;
      }

      // Take 4-5 random spares (already randomized by ORDER BY RANDOM())
      const numSpares = Math.min(sparesResult.rows.length, Math.floor(Math.random() * 2) + 4); // 4 or 5
      const selectedSpares = sparesResult.rows.slice(0, numSpares);

      // Format for the required_spare_parts JSON field
      const requiredSpareParts: RequiredSparePart[] = selectedSpares.map(spare => ({
        partNo: spare.part_number || 'N/A',
        description: spare.part_name || 'Spare Part',
        quantityRequired: String(Math.floor(Math.random() * 3) + 1) // 1 to 3 quantity
      }));

      // Update the job
      await pool.query(`
        UPDATE jobs 
        SET required_spare_parts = $1
        WHERE id = $2
      `, [JSON.stringify(requiredSpareParts), job.job_id]);

      console.log(`  Updated job ${job.job_code}: ${requiredSpareParts.length} spare parts assigned`);
      requiredSpareParts.forEach((sp, idx) => {
        console.log(`    ${idx + 1}. ${sp.partNo} - ${sp.description} (Qty: ${sp.quantityRequired})`);
      });
      console.log('');

      updatedCount++;
    }

    console.log(`\nCompleted! Updated ${updatedCount} jobs with required spare parts.`);

  } catch (error) {
    console.error('Error populating job spares:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

populateJobSpares();
