const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const BATCH_QUERY = 100;
const BATCH_UPDATE = 50;

function getNoOfPersons(jobTitle) {
  const t = (jobTitle || '').toLowerCase();
  if (t.includes('emergency') || t.includes('breakdown')) return 2 + Math.floor(Math.random() * 3);
  if (t.includes('overhaul')) return 2 + Math.floor(Math.random() * 2);
  if (t.includes('renewal') || t.includes('replace')) return 2 + Math.floor(Math.random() * 2);
  if (t.includes('routine')) return 1;
  if (t.includes('inspection') || t.includes('check')) return 1 + Math.floor(Math.random() * 2);
  return 1 + Math.floor(Math.random() * 2);
}

function getRemarks(jobTitle) {
  const t = (jobTitle || '').toLowerCase();
  const r = Math.random();
  let base;
  if (r < 0.40) {
    const variants = [
      `Equipment tested satisfactorily after maintenance. No issues found.`,
      `Equipment tested satisfactorily after completion of ${jobTitle || 'maintenance'}. No issues found.`,
      `All equipment tested satisfactorily post-maintenance. No abnormalities detected.`,
    ];
    base = variants[Math.floor(Math.random() * variants.length)];
  } else if (r < 0.60) {
    const variants = [
      `Minor adjustments made. Equipment performance within acceptable parameters.`,
      `Minor adjustments carried out during ${jobTitle || 'maintenance'}. Performance within acceptable parameters.`,
      `Small adjustments made to operating parameters. Equipment performance satisfactory.`,
    ];
    base = variants[Math.floor(Math.random() * variants.length)];
  } else if (r < 0.75) {
    const variants = [
      `All checks completed as per manufacturer guidelines. Next service due as scheduled.`,
      `Checks completed as per manufacturer guidelines for ${jobTitle || 'this equipment'}. Next service due as scheduled.`,
      `All maintenance checks completed per OEM recommendations. Next scheduled service as per PMS.`,
    ];
    base = variants[Math.floor(Math.random() * variants.length)];
  } else if (r < 0.85) {
    const variants = [
      `Spare parts replaced as listed. Old parts retained for inspection/disposal.`,
      `Required spare parts replaced during ${jobTitle || 'maintenance'}. Old parts retained for inspection.`,
      `Consumable parts replaced as per maintenance plan. Used parts stored for disposal.`,
    ];
    base = variants[Math.floor(Math.random() * variants.length)];
  } else if (r < 0.95) {
    const variants = [
      `Work delayed due to weather/operational constraints. Completed during port stay.`,
      `Work on ${jobTitle || 'this task'} delayed due to operational requirements. Completed during next available window.`,
      `Completion delayed due to vessel operational schedule. Work carried out during port call.`,
    ];
    base = variants[Math.floor(Math.random() * variants.length)];
  } else {
    const variants = [
      `Additional findings noted - recommend follow-up inspection during next scheduled maintenance.`,
      `Additional observations during ${jobTitle || 'maintenance'} - recommend follow-up at next scheduled interval.`,
      `Minor additional findings recorded. Follow-up inspection recommended during next maintenance period.`,
    ];
    base = variants[Math.floor(Math.random() * variants.length)];
  }
  return base;
}

function getFindings(jobTitle) {
  const t = (jobTitle || '').toLowerCase();
  const r = Math.random();
  if (r < 0.70) {
    return "No abnormalities found. All parameters within normal range.";
  } else if (r < 0.85) {
    return "Minor wear observed on sealing surfaces. Within acceptable limits.";
  } else if (r < 0.95) {
    return "Slight misalignment detected and corrected. Performance restored to specification.";
  } else {
    let part = "critical components";
    if (t.includes('pump')) part = "impeller wear rings";
    else if (t.includes('valve')) part = "valve seat and disc";
    else if (t.includes('bearing')) part = "bearing surfaces";
    else if (t.includes('filter')) part = "filter element housing";
    else if (t.includes('compressor')) part = "piston rings";
    else if (t.includes('engine') || t.includes('motor')) part = "cylinder liner surfaces";
    else if (t.includes('generator')) part = "brush gear assembly";
    else if (t.includes('cooler') || t.includes('heat')) part = "tube bundle";
    else if (t.includes('separator') || t.includes('purifier')) part = "disc stack";
    return `Significant wear on ${part}. Replacement recommended at next overhaul interval.`;
  }
}

function getActionsTaken(jobTitle) {
  const t = (jobTitle || '').toLowerCase();
  if (t.includes('inspection') || t.includes('check')) return "Visual and operational inspection carried out. Measurements recorded.";
  if (t.includes('overhaul')) return "Complete dismantling, cleaning, inspection and reassembly performed.";
  if (t.includes('calibrat')) return "Calibration performed against reference standard. Readings adjusted to specification.";
  if (t.includes('clean')) return "Thorough cleaning carried out. All deposits removed.";
  if (t.includes('test')) return "Functional testing completed as per procedure. All results recorded.";
  if (t.includes('replace') || t.includes('renew')) return "Old components removed and new parts fitted. System tested after installation.";
  if (t.includes('service') || t.includes('maintenance')) return "Scheduled maintenance tasks completed. Consumables replaced as required.";
  return "Maintenance activities carried out as per planned procedure.";
}

function buildFormData(wo, noOfPersons) {
  return {
    sectionA: {
      jobTitle: wo.job_title || "",
      componentCode: wo.component_code || "",
      assignedTo: wo.assigned_to || "",
      maintenanceBasis: wo.maintenance_basis || "",
      dueDate: wo.due_date || "",
      workOrderNo: wo.work_order_no || ""
    },
    sectionB: {
      workPerformed: wo.work_carried_out || "",
      findings: getFindings(wo.job_title),
      actionsTaken: getActionsTaken(wo.job_title),
      safetyMeasures: "Standard safety procedures followed. PPE worn as required."
    },
    sectionB2: {
      remarks: wo.completion_remarks || ""
    },
    sectionC: {
      sparesConsumed: wo.consumed_spare_parts || ""
    },
    sectionD: {
      completedBy: wo.performed_by || "",
      completionDate: wo.date_completed || "",
      verifiedBy: "Chief Engineer",
      approvedBy: wo.approver || "",
      approvalDate: wo.approval_date || "",
      noOfPersons: noOfPersons,
      totalManHours: wo.manhours || ""
    }
  };
}

async function main() {
  try {
    console.log('=== Fix Vessel 3 WO: no_of_persons, remarks, form_data ===\n');

    const countResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 AND status = 'Completed' AND (no_of_persons IS NULL OR remarks IS NULL OR form_data IS NULL)`,
      [VESSEL_ID]
    );
    const totalToFix = parseInt(countResult.rows[0].cnt);
    console.log(`Total completed WOs needing updates: ${totalToFix}\n`);

    let offset = 0;
    let totalUpdated = 0;

    while (offset < totalToFix + BATCH_QUERY) {
      const batch = await pool.query(
        `SELECT id, job_title, component_code, assigned_to, maintenance_basis, due_date, work_order_no,
                work_carried_out, completion_remarks, consumed_spare_parts, performed_by, date_completed,
                approver, approval_date, manhours, no_of_persons, remarks, form_data
         FROM work_orders
         WHERE vessel_id = $1 AND status = 'Completed' AND (no_of_persons IS NULL OR remarks IS NULL OR form_data IS NULL)
         ORDER BY id
         LIMIT $2`,
        [VESSEL_ID, BATCH_QUERY]
      );

      if (batch.rows.length === 0) break;

      const updates = [];
      for (const wo of batch.rows) {
        const noOfPersons = wo.no_of_persons != null ? wo.no_of_persons : getNoOfPersons(wo.job_title);
        const remarks = wo.remarks != null ? wo.remarks : getRemarks(wo.job_title);
        const formData = wo.form_data != null ? wo.form_data : buildFormData(wo, noOfPersons);

        updates.push({ id: wo.id, noOfPersons, remarks, formData });
      }

      for (let i = 0; i < updates.length; i += BATCH_UPDATE) {
        const chunk = updates.slice(i, i + BATCH_UPDATE);
        const promises = chunk.map(u =>
          pool.query(
            `UPDATE work_orders SET no_of_persons = $1, remarks = $2, form_data = $3 WHERE id = $4`,
            [u.noOfPersons, u.remarks, JSON.stringify(u.formData), u.id]
          )
        );
        await Promise.all(promises);
        totalUpdated += chunk.length;
      }

      console.log(`  Progress: ${totalUpdated} updated so far...`);
      offset += batch.rows.length;
    }

    console.log(`\nTotal updated: ${totalUpdated}`);

    console.log('\n=== VERIFICATION ===');
    const verify = await pool.query(
      `SELECT
        COUNT(*) as total_completed,
        COUNT(CASE WHEN no_of_persons IS NOT NULL THEN 1 END) as has_persons,
        COUNT(CASE WHEN remarks IS NOT NULL THEN 1 END) as has_remarks,
        COUNT(CASE WHEN form_data IS NOT NULL THEN 1 END) as has_form_data
       FROM work_orders WHERE vessel_id = $1 AND status = 'Completed'`,
      [VESSEL_ID]
    );
    const v = verify.rows[0];
    console.log(`Completed WOs: ${v.total_completed}`);
    console.log(`  Has no_of_persons: ${v.has_persons}`);
    console.log(`  Has remarks: ${v.has_remarks}`);
    console.log(`  Has form_data: ${v.has_form_data}`);

    const sample = await pool.query(
      `SELECT id, job_title, no_of_persons, remarks, form_data
       FROM work_orders WHERE vessel_id = $1 AND status = 'Completed' AND form_data IS NOT NULL
       LIMIT 3`,
      [VESSEL_ID]
    );
    console.log('\n=== SAMPLE RECORDS ===');
    for (const s of sample.rows) {
      console.log(`\nWO ID: ${s.id}`);
      console.log(`  Job: ${s.job_title}`);
      console.log(`  No of persons: ${s.no_of_persons}`);
      console.log(`  Remarks: ${s.remarks}`);
      const fd = typeof s.form_data === 'string' ? JSON.parse(s.form_data) : s.form_data;
      console.log(`  form_data.sectionA.jobTitle: ${fd.sectionA?.jobTitle}`);
      console.log(`  form_data.sectionB.findings: ${fd.sectionB?.findings}`);
      console.log(`  form_data.sectionD.noOfPersons: ${fd.sectionD?.noOfPersons}`);
    }

    console.log('\n=== DONE ===');
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
