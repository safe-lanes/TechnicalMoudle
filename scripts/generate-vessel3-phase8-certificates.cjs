const { Pool } = require('pg');

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';

function formatDateDMY(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('=== Phase 8: Certificates & Surveys ===');
    
    const certMasters = await pool.query(`SELECT id, certificate_name FROM ship_certificates_master ORDER BY id LIMIT 30`);
    console.log(`Found ${certMasters.rows.length} certificate masters`);
    
    const surveyMasters = await pool.query(`SELECT id, survey_name FROM ship_surveys_master ORDER BY id LIMIT 30`);
    console.log(`Found ${surveyMasters.rows.length} survey masters`);
    
    let certCount = 0;
    for (const master of certMasters.rows) {
      const issueDate = new Date('2023-06-15');
      issueDate.setDate(issueDate.getDate() + Math.floor(Math.random() * 180));
      
      const expiryDate = new Date(issueDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 5);
      
      const lastAnnual = new Date('2025-06-01');
      lastAnnual.setDate(lastAnnual.getDate() + Math.floor(Math.random() * 60));
      
      const lastInterm = new Date('2024-09-01');
      lastInterm.setDate(lastInterm.getDate() + Math.floor(Math.random() * 60));
      
      try {
        await pool.query(
          `INSERT INTO vessel_certificate_data (
            vessel_id, vessel_name, master_id, issue_date, expiry_date, 
            last_annual, last_interm, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
          ON CONFLICT DO NOTHING`,
          [
            VESSEL_ID, 'Vessel 3', master.id.toString(),
            formatDateDMY(issueDate), formatDateDMY(expiryDate),
            formatDateDMY(lastAnnual), formatDateDMY(lastInterm)
          ]
        );
        certCount++;
      } catch (err) {
        console.error(`Certificate error for ${master.id}: ${err.message}`);
      }
    }
    console.log(`Certificates inserted: ${certCount}`);
    
    let surveyCount = 0;
    for (const master of surveyMasters.rows) {
      const numSurveys = 1 + Math.floor(Math.random() * 3);
      
      for (let s = 0; s < numSurveys; s++) {
        const surveyDate = new Date('2023-03-01');
        surveyDate.setDate(surveyDate.getDate() + Math.floor(Math.random() * 1050));
        
        const dueDate = new Date(surveyDate);
        dueDate.setFullYear(dueDate.getFullYear() + 1);
        
        const firstRange = new Date(dueDate);
        firstRange.setMonth(firstRange.getMonth() - 3);
        const secondRange = new Date(dueDate);
        secondRange.setMonth(secondRange.getMonth() + 3);
        
        try {
          await pool.query(
            `INSERT INTO vessel_survey_data (
              vessel_id, vessel_name, master_id, survey_date, due_date,
              first_range_date, second_range_date, postponed,
              created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
            [
              VESSEL_ID, 'Vessel 3', master.id.toString(),
              formatDateDMY(surveyDate), formatDateDMY(dueDate),
              formatDateDMY(firstRange), formatDateDMY(secondRange),
              Math.random() < 0.1 ? 'Yes' : 'No'
            ]
          );
          surveyCount++;
        } catch (err) {
          console.error(`Survey error: ${err.message}`);
        }
      }
    }
    console.log(`Survey records inserted: ${surveyCount}`);
    
    console.log(`\n=== COMPLETE ===`);
    console.log(`Certificates: ${certCount}, Surveys: ${surveyCount}`);
    
  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
