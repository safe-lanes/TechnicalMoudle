import { Pool } from 'pg';

async function dropConstraint() {
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not available');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Connecting to database...');
    
    // Check if the constraint exists
    const result = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'jobs' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name LIKE '%job_no%'
    `);
    
    console.log('Found constraints:', result.rows);
    
    if (result.rows.length > 0) {
      for (const row of result.rows) {
        console.log('Dropping constraint:', row.constraint_name);
        await pool.query(`ALTER TABLE jobs DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
        console.log('Dropped:', row.constraint_name);
      }
    }
    
    // Also check for unique indexes
    const indexResult = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'jobs' 
      AND indexname LIKE '%job_no%'
    `);
    
    console.log('Found indexes:', indexResult.rows);
    
    if (indexResult.rows.length > 0) {
      for (const row of indexResult.rows) {
        console.log('Dropping index:', row.indexname);
        await pool.query(`DROP INDEX IF EXISTS "${row.indexname}"`);
        console.log('Dropped index:', row.indexname);
      }
    }
    
    console.log('Successfully removed job_no unique constraint!');
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

dropConstraint();
