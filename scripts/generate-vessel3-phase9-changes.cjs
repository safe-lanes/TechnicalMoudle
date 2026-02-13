const { Pool } = require('pg');

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const START_DATE = new Date('2023-02-13');
const END_DATE = new Date('2026-02-13');

const CREW = {
  chief_eng: '228b5256-5bd2-4bf3-826f-c6fe76571449',
  second_eng: '056a433e-b880-43c6-9d59-b1cfe71a4014',
  third_eng: '6084f3b8-85dc-462a-b045-111d2b2e6d0e',
};

const CATEGORIES = [
  'Job Interval Modification',
  'Component Replacement',
  'New Equipment Addition',
  'Equipment Decommission',
  'Procedure Modification',
  'Software/Manual Update',
];

const REASONS = [
  'Manufacturer updated maintenance interval recommendation per latest service bulletin.',
  'Component reached end of service life. New specification component to be fitted.',
  'New equipment installed as part of vessel upgrade project.',
  'Equipment obsolete and removed from service. No replacement required.',
  'Updated maintenance procedure based on fleet experience and manufacturer guidance.',
  'Software update applied per maker\'s technical bulletin. Manual updated accordingly.',
  'Class society recommendation to modify inspection frequency.',
  'Operational experience suggests more frequent inspection is beneficial.',
  'Spare part number changed by manufacturer. PMS updated to reflect new part details.',
  'Job scope expanded based on condition monitoring findings.',
];

const STATUSES = ['Approved', 'Approved', 'Approved', 'Approved', 'Pending', 'Rejected'];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('=== Phase 9: Change Requests ===');
    
    const componentsResult = await pool.query(
      `SELECT id, component_code, name FROM components WHERE vessel_id = $1 LIMIT 50`,
      [VESSEL_ID]
    );
    const components = componentsResult.rows;
    
    const jobsResult = await pool.query(
      `SELECT id, job_title, component_id FROM jobs WHERE vessel_id = $1 LIMIT 50`,
      [VESSEL_ID]
    );
    const jobs = jobsResult.rows;
    
    const totalRequests = 20 + Math.floor(Math.random() * 10);
    console.log(`Generating ${totalRequests} change requests`);
    
    let inserted = 0;
    for (let i = 0; i < totalRequests; i++) {
      const dayOffset = Math.floor(Math.random() * 1096);
      const submitDate = new Date(START_DATE);
      submitDate.setDate(submitDate.getDate() + dayOffset);
      
      const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      const reason = REASONS[Math.floor(Math.random() * REASONS.length)];
      const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
      const comp = components[Math.floor(Math.random() * components.length)];
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      
      const requestedBy = Math.random() < 0.5 ? CREW.second_eng : CREW.third_eng;
      
      const reviewDate = status !== 'Pending' ? new Date(submitDate.getTime() + 86400000 * (2 + Math.floor(Math.random() * 5))) : null;
      
      const title = `${category} - ${comp.name || 'Component'}`;
      
      try {
        await pool.query(
          `INSERT INTO change_request (
            vessel_id, category, title, reason, target_type, target_id,
            snapshot_before_json, proposed_changes_json,
            status, requested_by_user_id, submitted_at,
            reviewed_by_user_id, reviewed_at, revision_number,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            VESSEL_ID, category, title, reason,
            Math.random() < 0.6 ? 'job' : 'component',
            Math.random() < 0.6 ? job.id : comp.id,
            JSON.stringify({ note: 'Original configuration before change' }),
            JSON.stringify({ note: reason }),
            status, requestedBy,
            submitDate,
            status !== 'Pending' ? CREW.chief_eng : null,
            reviewDate,
            1, submitDate, reviewDate || submitDate
          ]
        );
        inserted++;
      } catch (err) {
        console.error(`Error inserting CR: ${err.message}`);
      }
    }
    
    console.log(`\n=== COMPLETE ===`);
    console.log(`Change requests inserted: ${inserted}`);
    
    const verify = await pool.query(
      `SELECT status, COUNT(*) FROM change_request WHERE vessel_id = $1 GROUP BY status`,
      [VESSEL_ID]
    );
    console.log('\nVerification:');
    for (const row of verify.rows) {
      console.log(`  ${row.status}: ${row.count}`);
    }
    
  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
