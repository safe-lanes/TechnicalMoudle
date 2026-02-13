const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';

const BRIEF_REMARKS = [
  "Routine inspection completed. All parameters within normal range.",
  "Scheduled maintenance carried out as per PMS requirement.",
  "Job completed satisfactorily. Equipment tested and found in good working order.",
  "Maintenance performed as planned. No deficiencies noted.",
  "Task completed. All readings within acceptable limits.",
  "Work carried out as per planned schedule. System operational.",
  "Inspection completed. Equipment condition satisfactory.",
  "Preventive maintenance done. No issues found.",
  "Service completed successfully. Equipment returned to service.",
  "Routine check completed. All components in good condition.",
  "Maintenance carried out per maker's recommendations.",
  "Job done as per maintenance plan. Equipment functioning normally.",
  "Scheduled task completed. No abnormalities detected.",
  "Work completed on time. Equipment performance satisfactory.",
];

const DETAILED_REMARKS = [
  "Thorough inspection carried out on all accessible parts. Clearances measured and found within maker's tolerances. Wear patterns consistent with normal operation. All fasteners checked for tightness. Equipment reassembled and tested under load conditions.",
  "Complete service performed including cleaning, lubrication and adjustment. All filters replaced and oil samples taken for shore analysis. Operating parameters recorded before and after service. Equipment performance improved after maintenance.",
  "Comprehensive check completed. All electrical connections inspected and tightened. Insulation resistance measured and found satisfactory at above 100 megohms. Control circuits tested for proper operation. Safety interlocks verified functional.",
  "Full inspection carried out as per maintenance procedure. Surface condition examined - no cracks or excessive wear detected. Protective coating intact. All mountings secure. Alignment checked and found within specification.",
  "Detailed examination performed. All moving parts inspected for wear. Lubricating oil condition checked - no contamination found. Vibration levels measured and compared with baseline readings. All values within acceptable range.",
];

const SPARE_PARTS_REMARKS = [
  "Replaced worn gaskets and O-rings. Old parts showed signs of deterioration. New parts fitted and tested satisfactory.",
  "Renewed filter elements and cleaned housings. Old filters showed heavy contamination. System flushed before fitting new elements. Differential pressure returned to normal.",
  "Replaced worn bearings during scheduled overhaul. Old bearings showed normal wear pattern. New bearings properly greased and installed. Post-installation vibration check satisfactory.",
  "Changed seals and packing as per maintenance schedule. Previous seals showed minor leakage. New seals fitted and system pressure tested. No leaks observed.",
  "Replaced impeller and wear rings. Old impeller showed cavitation damage. New parts installed and pump performance restored to rated capacity.",
];

const FINDINGS_REMARKS = [
  "Minor corrosion observed on mounting bolts. Recommend monitoring during next inspection cycle.",
  "Slight wear noted on contact surfaces. Currently within acceptable limits but trending toward replacement threshold. Recommend increased monitoring frequency.",
  "Small amount of water contamination found in oil sample. Source investigated and traced to condensation. Drain plug gasket replaced. Recommend follow-up oil analysis in 500 hours.",
  "Hairline crack detected on non-critical bracket. Temporary repair carried out with welding. Permanent replacement part ordered. Monitor until replacement received.",
  "Increased vibration readings noted compared to previous inspection. Still within acceptable limits. Alignment rechecked and adjusted. Recommend vibration analysis at next interval.",
];

function getContextualRemarks(jobTitle, type) {
  const title = (jobTitle || '').toLowerCase();

  if (type === 'brief') {
    if (title.includes('inspection') || title.includes('check')) {
      const opts = [
        "Inspection completed. All parameters within normal range.",
        "Visual and operational inspection carried out. No deficiencies found.",
        "Inspection completed as per PMS. Equipment in satisfactory condition.",
        "Routine inspection performed. All readings normal.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }
    if (title.includes('overhaul')) {
      const opts = [
        "Overhaul completed. All clearances within maker's tolerance. Equipment tested under load.",
        "Complete overhaul carried out as per maker's instructions. Equipment tested satisfactorily.",
        "Overhaul done. All worn parts renewed. Equipment back in service.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }
    if (title.includes('calibrat')) {
      const opts = [
        "Calibration carried out. All readings within acceptable range.",
        "Instrument calibrated against reference standard. Accuracy confirmed within tolerance.",
        "Calibration completed. Certificate updated.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }
    if (title.includes('service') || title.includes('maintenance')) {
      const opts = [
        "Scheduled maintenance carried out as per PMS requirement.",
        "Service completed. Oil changed and filters replaced. Equipment running smoothly.",
        "Routine service performed. All consumables replaced as required.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }
    if (title.includes('clean')) {
      const opts = [
        "Cleaning carried out. All surfaces free of deposits and contamination.",
        "Thorough cleaning performed. System flushed and inspected before reassembly.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }
    if (title.includes('test')) {
      const opts = [
        "Testing completed. All parameters within acceptable limits.",
        "Functional test carried out. Equipment operating as designed.",
        "Test performed as per procedure. Results satisfactory.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }
    if (title.includes('replace') || title.includes('renew')) {
      const opts = [
        "Replacement completed. New parts fitted and tested satisfactory.",
        "Renewal carried out. Old parts removed and new parts installed. System tested.",
      ];
      return opts[Math.floor(Math.random() * opts.length)];
    }
    return BRIEF_REMARKS[Math.floor(Math.random() * BRIEF_REMARKS.length)];
  }

  if (type === 'detailed') return DETAILED_REMARKS[Math.floor(Math.random() * DETAILED_REMARKS.length)];
  if (type === 'spare_parts') return SPARE_PARTS_REMARKS[Math.floor(Math.random() * SPARE_PARTS_REMARKS.length)];
  if (type === 'findings') return FINDINGS_REMARKS[Math.floor(Math.random() * FINDINGS_REMARKS.length)];
  return BRIEF_REMARKS[0];
}

function getWorkCarriedOut(jobTitle, completionRemarks) {
  const title = (jobTitle || '').toLowerCase();

  let base = '';
  if (title.includes('inspection') || title.includes('check')) {
    base = `Carried out ${jobTitle}. Opened up and inspected all accessible parts. Checked for wear, corrosion and damage. Recorded all measurements and observations. Closed up and returned equipment to service.`;
  } else if (title.includes('overhaul')) {
    base = `Performed ${jobTitle}. Dismantled equipment and cleaned all components. Inspected all parts for wear and damage. Replaced worn components as required. Reassembled with correct torque values and clearances. Tested equipment under operating conditions.`;
  } else if (title.includes('calibrat')) {
    base = `Completed ${jobTitle}. Connected reference instruments and compared readings. Adjusted as necessary to bring within specified tolerance. Recorded before and after readings. Updated calibration records.`;
  } else if (title.includes('service') || title.includes('maintenance')) {
    base = `Performed ${jobTitle}. Carried out all scheduled maintenance tasks as per PMS procedure. Changed oils and filters where required. Checked and adjusted all settings. Tested equipment operation after service.`;
  } else if (title.includes('clean')) {
    base = `Carried out ${jobTitle}. Removed all deposits and contamination. Flushed system with approved cleaning agent. Inspected surfaces for damage or corrosion. Reassembled and tested.`;
  } else if (title.includes('test')) {
    base = `Performed ${jobTitle}. Set up test equipment and carried out required tests as per procedure. Recorded all test results and compared with acceptance criteria. Equipment meets all specified requirements.`;
  } else if (title.includes('replace') || title.includes('renew')) {
    base = `Carried out ${jobTitle}. Removed old components and inspected mounting surfaces. Fitted new parts ensuring correct alignment and torque. Tested system for leaks and proper operation.`;
  } else if (title.includes('lubrication') || title.includes('grease') || title.includes('oil')) {
    base = `Performed ${jobTitle}. Drained old lubricant and inspected for contamination. Cleaned lubrication points. Applied fresh lubricant as per maker's specifications. Checked for leaks.`;
  } else if (title.includes('valve')) {
    base = `Carried out ${jobTitle}. Inspected valve seat and disc for wear and damage. Checked gland packing and stem condition. Operated valve through full range and checked for leaks. Valve operation satisfactory.`;
  } else if (title.includes('pump')) {
    base = `Performed ${jobTitle}. Checked pump performance parameters including flow rate and discharge pressure. Inspected mechanical seal and bearings. Checked alignment and vibration. Pump operating within specifications.`;
  } else if (title.includes('filter')) {
    base = `Carried out ${jobTitle}. Removed and inspected filter elements. Cleaned filter housing. Fitted new/cleaned elements. Checked differential pressure after start-up. System operating normally.`;
  } else if (title.includes('alarm') || title.includes('sensor')) {
    base = `Performed ${jobTitle}. Tested alarm/sensor operation by simulating alarm conditions. Verified correct set points and response times. Checked wiring and connections. All alarms functioning correctly.`;
  } else {
    base = `Carried out ${jobTitle}. Followed planned maintenance procedure for the task. Inspected equipment condition and carried out all required maintenance activities. Equipment tested and returned to normal service.`;
  }
  return base;
}

const CANCELLATION_REASONS = [
  "Cancelled - Equipment replaced/removed from vessel",
  "Cancelled - Superseded by updated maintenance plan",
  "Cancelled - Component decommissioned",
  "Cancelled - Duplicate work order",
  "Cancelled - Job merged with another work order",
  "Cancelled - Equipment no longer in service",
  "Cancelled - Maintenance interval revised by Class",
  "Cancelled - Scope covered under separate dry-dock work order",
];

async function main() {
  try {
    console.log('=== Phase 3a: Completion Notes & Cancelled WOs ===\n');

    // PART 1: Populate work_carried_out and performed_by for completed WOs
    console.log('--- PART 1: Populating completion notes ---');
    const result = await pool.query(
      `SELECT id, job_title, assigned_to, completion_remarks, work_carried_out, performed_by
       FROM work_orders
       WHERE vessel_id = $1
         AND status = 'Completed'
         AND ((work_carried_out IS NULL OR work_carried_out = '') OR (completion_remarks IS NULL OR completion_remarks = ''))
       ORDER BY id`,
      [VESSEL_ID]
    );

    console.log(`Found ${result.rows.length} completed WOs needing notes/work_carried_out`);

    let updatedCount = 0;
    let performedByCount = 0;

    for (const wo of result.rows) {
      const rand = Math.random();
      let type;
      if (rand < 0.70) type = 'brief';
      else if (rand < 0.85) type = 'detailed';
      else if (rand < 0.95) type = 'spare_parts';
      else type = 'findings';

      const needsRemarks = !wo.completion_remarks || wo.completion_remarks === '';
      const needsWorkCarried = !wo.work_carried_out || wo.work_carried_out === '';
      const needsPerformer = !wo.performed_by;

      const remarks = needsRemarks ? getContextualRemarks(wo.job_title, type) : wo.completion_remarks;
      const workCarried = needsWorkCarried ? getWorkCarriedOut(wo.job_title, remarks) : wo.work_carried_out;
      const performer = needsPerformer ? (wo.assigned_to || '2nd Engineer') : wo.performed_by;

      await pool.query(
        `UPDATE work_orders
         SET completion_remarks = $1,
             work_carried_out = $2,
             performed_by = $3
         WHERE id = $4`,
        [remarks, workCarried, performer, wo.id]
      );
      updatedCount++;
      if (needsPerformer) performedByCount++;

      if (updatedCount % 200 === 0) {
        console.log(`  Progress: ${updatedCount}/${result.rows.length}`);
      }
    }

    console.log(`  Updated ${updatedCount} WOs with completion notes`);
    console.log(`  Set performed_by for ${performedByCount} WOs`);

    // Also fix performed_by for any remaining completed WOs that have it null
    const perfResult = await pool.query(
      `UPDATE work_orders
       SET performed_by = assigned_to
       WHERE vessel_id = $1
         AND status = 'Completed'
         AND performed_by IS NULL
         AND assigned_to IS NOT NULL`,
      [VESSEL_ID]
    );
    console.log(`  Additional performed_by fixes: ${perfResult.rowCount}`);

    // PART 2: Convert 25 WOs to Cancelled
    console.log('\n--- PART 2: Converting 25 WOs to Cancelled ---');
    const cancelCandidates = await pool.query(
      `SELECT id, job_title, due_date, date_completed
       FROM work_orders
       WHERE vessel_id = $1
         AND status = 'Completed'
         AND date_completed IS NOT NULL
         AND (date_completed < '2025-01-01' OR due_date < '01-Jan-2025')
       ORDER BY date_completed
       LIMIT 25`,
      [VESSEL_ID]
    );

    console.log(`Found ${cancelCandidates.rows.length} candidates for cancellation`);

    let cancelledCount = 0;
    for (const wo of cancelCandidates.rows) {
      const reason = CANCELLATION_REASONS[Math.floor(Math.random() * CANCELLATION_REASONS.length)];
      await pool.query(
        `UPDATE work_orders
         SET status = 'Cancelled',
             completion_remarks = $1,
             date_completed = NULL,
             work_carried_out = NULL
         WHERE id = $2`,
        [reason, wo.id]
      );
      cancelledCount++;
    }
    console.log(`  Cancelled ${cancelledCount} work orders`);

    // Summary
    console.log('\n=== SUMMARY ===');
    const verify = await pool.query(
      `SELECT status, COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 GROUP BY status ORDER BY cnt DESC`,
      [VESSEL_ID]
    );
    console.log('Work order status distribution:');
    for (const row of verify.rows) {
      console.log(`  ${row.status}: ${row.cnt}`);
    }

    const noteCheck = await pool.query(
      `SELECT 
        COUNT(*) as total_completed,
        COUNT(CASE WHEN work_carried_out IS NOT NULL AND work_carried_out != '' THEN 1 END) as has_work_carried,
        COUNT(CASE WHEN completion_remarks IS NOT NULL AND completion_remarks != '' THEN 1 END) as has_remarks,
        COUNT(CASE WHEN performed_by IS NOT NULL THEN 1 END) as has_performer
       FROM work_orders WHERE vessel_id = $1 AND status = 'Completed'`,
      [VESSEL_ID]
    );
    const nc = noteCheck.rows[0];
    console.log(`\nCompleted WOs data quality:`);
    console.log(`  Total completed: ${nc.total_completed}`);
    console.log(`  Has work_carried_out: ${nc.has_work_carried}`);
    console.log(`  Has completion_remarks: ${nc.has_remarks}`);
    console.log(`  Has performed_by: ${nc.has_performer}`);

    console.log('\n=== Phase 3a COMPLETE ===');

  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
