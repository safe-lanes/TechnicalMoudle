const { Pool } = require('pg');

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const PASSWORD = 'vessel3pass';

const crewData = [
  { username: 'v3_chief_eng', fullName: 'Chief Engineer', department: 'Engine' },
  { username: 'v3_2nd_eng', fullName: '2nd Engineer', department: 'Engine' },
  { username: 'v3_3rd_eng', fullName: '3rd Engineer', department: 'Engine' },
  { username: 'v3_4th_eng', fullName: '4th Engineer', department: 'Engine' },
  { username: 'v3_electrician', fullName: 'Electrical Engineer', department: 'Engine' },
  { username: 'v3_master', fullName: 'Master', department: 'Deck' },
  { username: 'v3_chief_officer', fullName: 'Chief Officer', department: 'Deck' },
];

async function insertCrewUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();

    console.log(`\nInserting Vessel 3 crew users into the users table...`);
    console.log(`Vessel ID: ${VESSEL_ID}\n`);

    const createdUsers = [];

    for (const crew of crewData) {
      const query = `
        INSERT INTO users (username, password, full_name, role, vessel_id, department, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (username) DO NOTHING
        RETURNING id, username, full_name, department;
      `;

      const result = await client.query(query, [
        crew.username,
        PASSWORD,
        crew.fullName,
        'Ship',
        VESSEL_ID,
        crew.department,
      ]);

      if (result.rows.length > 0) {
        const user = result.rows[0];
        console.log(`✓ Created: ${user.full_name} (${user.username}) - ID: ${user.id} - Department: ${user.department}`);
        createdUsers.push(user);
      } else {
        console.log(`⊘ Already exists: ${crew.username}`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total users created: ${createdUsers.length}`);
    console.log(`Total crew entries processed: ${crewData.length}`);

    if (createdUsers.length > 0) {
      console.log(`\nCreated User IDs:`);
      createdUsers.forEach(user => {
        console.log(`  - ${user.username}: ${user.id}`);
      });
    }

    client.release();
  } catch (error) {
    console.error('Error inserting crew users:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

insertCrewUsers();
