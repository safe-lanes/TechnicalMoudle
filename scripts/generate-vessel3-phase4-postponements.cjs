const { Pool } = require('pg');

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';

const POSTPONEMENT_REASONS = [
  'Spare parts not available',
  'Weather conditions unfavorable',
  'Vessel in critical operation period',
  'Manpower shortage',
  'Awaiting port arrival',
  'Pending technical clarification',
  'Equipment in continuous use',
  'Awaiting manufacturer guidance',
  'Port schedule changed',
  'Higher priority work in progress',
];

const JUSTIFICATIONS = [
  'Required spare parts on order, expected delivery at next port.',
  'Heavy weather conditions make it unsafe to carry out maintenance.',
  'Vessel currently in cargo operations, cannot take equipment offline.',
  'Crew change in progress, insufficient technical staff available.',
  'Work requires shore support / workshop facilities at port.',
  'Awaiting technical bulletin from equipment manufacturer.',
  'Equipment cannot be isolated as it is critical for current operations.',
  'Consulting manufacturer for updated procedure guidance.',
  'Port call delayed, maintenance planned during port stay.',
  'Emergency repair on critical equipment taking priority.',
];

function formatDateDMY(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function parseDate(str) {
  if (!str) return null;
  const months = {'Jan':0,'Feb':1,'Mar':2,'Apr':3,'May':4,'Jun':5,'Jul':6,'Aug':7,'Sep':8,'Oct':9,'Nov':10,'Dec':11};
  const parts = str.split('-');
  if (parts.length >= 3) {
    return new Date(parseInt(parts[2]), months[parts[1]] || 0, parseInt(parts[0]));
  }
  return null;
}

function generateId() {
  return `PP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('=== Phase 4: Work Order Postponements ===');
    
    const lateWOs = await pool.query(
      `SELECT id, work_order_no, due_date, date_completed, assigned_to, department
       FROM work_orders 
       WHERE vessel_id = $1 
         AND status = 'Completed'
         AND date_completed IS NOT NULL
         AND id LIKE 'WO-%'
       ORDER BY due_date`,
      [VESSEL_ID]
    );
    
    console.log(`Found ${lateWOs.rows.length} completed work orders`);
    
    const overdueWOs = await pool.query(
      `SELECT id, work_order_no, due_date, assigned_to, department
       FROM work_orders 
       WHERE vessel_id = $1 
         AND status = 'Overdue'
         AND id LIKE 'WO-%'
       ORDER BY due_date`,
      [VESSEL_ID]
    );
    
    console.log(`Found ${overdueWOs.rows.length} overdue work orders`);
    
    let postponementCount = 0;
    const allCandidates = [...lateWOs.rows, ...overdueWOs.rows];
    
    const candidatesForPostponement = allCandidates.filter(() => Math.random() < 0.6);
    console.log(`Generating postponements for ${candidatesForPostponement.length} work orders`);
    
    for (const wo of candidatesForPostponement) {
      const dueDate = parseDate(wo.due_date);
      if (!dueDate) continue;
      
      const numPostponements = 1 + (Math.random() < 0.3 ? 1 : 0);
      
      for (let p = 0; p < numPostponements; p++) {
        postponementCount++;
        const reasonIdx = Math.floor(Math.random() * POSTPONEMENT_REASONS.length);
        const durationDays = 7 + Math.floor(Math.random() * 24);
        
        const submittedDate = new Date(dueDate);
        submittedDate.setDate(submittedDate.getDate() - 2 + p * durationDays);
        
        const newDueDate = new Date(submittedDate);
        newDueDate.setDate(newDueDate.getDate() + durationDays);
        
        const approvedDate = new Date(submittedDate);
        approvedDate.setDate(approvedDate.getDate() + 1 + Math.floor(Math.random() * 2));
        
        try {
          await pool.query(
            `INSERT INTO work_order_postponements (
              id, work_order_id, vessel_id, postponement_number, 
              original_due_date, new_due_date, postponement_reason,
              authorized_by, approval_remarks, duration_days,
              submitted_date, approved_date, approved_by, status,
              inform_office, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [
              generateId(), wo.id, VESSEL_ID, p + 1,
              wo.due_date, formatDateDMY(newDueDate), POSTPONEMENT_REASONS[reasonIdx],
              'Chief Engineer', JUSTIFICATIONS[reasonIdx], durationDays,
              formatDateDMY(submittedDate), formatDateDMY(approvedDate), 'Chief Engineer',
              'Approved', Math.random() < 0.3,
              submittedDate, approvedDate
            ]
          );
        } catch (err) {
          console.error(`Error: ${err.message}`);
        }
      }
    }
    
    console.log(`\n=== COMPLETE ===`);
    console.log(`Total postponements inserted: ${postponementCount}`);
    
    const verify = await pool.query(
      `SELECT COUNT(*) as total FROM work_order_postponements WHERE vessel_id = $1`,
      [VESSEL_ID]
    );
    console.log(`Verification: ${verify.rows[0].total} total postponements in database`);
    
  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
