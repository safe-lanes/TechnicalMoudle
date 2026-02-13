const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const START_DATE = new Date('2023-02-13');
const END_DATE = new Date('2026-02-13');
const TODAY = new Date('2026-02-13');
const TARGET_WOS = 700;
const BATCH_SIZE = 50;

const CREW_DISTRIBUTION = [
  { name: 'Chief Engineer', count: 178 },
  { name: '2nd Engineer', count: 190 },
  { name: '4th Engineer', count: 261 },
  { name: 'Electrican', count: 71 },
];

const STATUS_DISTRIBUTION = {
  completed: 525,
  overdue: 70,
  dueGrace: 70,
  active: 35,
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDateDMY(d) {
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function generateId() {
  return `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

let globalSeq = 0;
function generateWONumber(jobNo, compCode, year) {
  globalSeq++;
  return `${jobNo}-${compCode}-${year}-${String(globalSeq).padStart(3, '0')}`;
}

function getMaxWOsForJob(job) {
  const freq = parseInt(job.frequency_value) || 1;
  const unit = (job.frequency_unit || '').toLowerCase();
  const basis = (job.maintenance_basis || '').toLowerCase();

  if (basis === 'running hours' || basis === 'running_hours') {
    const interval = parseInt(job.interval_running_hour) || parseInt(job.frequency_value) || 0;
    if (interval <= 0) return 3;
    const totalRH = 7500 * 3;
    return Math.max(1, Math.floor(totalRH / interval));
  }

  if (unit.includes('week')) return 12;
  if (unit.includes('month')) {
    const totalMonths = 36;
    return Math.max(1, Math.floor(totalMonths / freq));
  }
  if (unit.includes('year')) {
    return Math.max(1, Math.floor(3 / freq));
  }
  if (unit.includes('day')) return 12;
  return 3;
}

function generateDueDatesForJob(job, count, statusType) {
  const dates = [];

  if (statusType === 'completed') {
    const rangeMs = END_DATE.getTime() - START_DATE.getTime();
    for (let i = 0; i < count; i++) {
      const offset = Math.random() * rangeMs;
      const d = new Date(START_DATE.getTime() + offset);
      if (d > new Date('2025-12-31')) {
        d.setTime(START_DATE.getTime() + Math.random() * (new Date('2025-12-31').getTime() - START_DATE.getTime()));
      }
      dates.push(d);
    }
  } else if (statusType === 'overdue') {
    for (let i = 0; i < count; i++) {
      const start = new Date('2025-10-01');
      const end = new Date('2026-02-06');
      const rangeMs = end.getTime() - start.getTime();
      dates.push(new Date(start.getTime() + Math.random() * rangeMs));
    }
  } else if (statusType === 'dueGrace') {
    for (let i = 0; i < count; i++) {
      const start = new Date('2025-11-01');
      const end = new Date('2026-02-10');
      const rangeMs = end.getTime() - start.getTime();
      dates.push(new Date(start.getTime() + Math.random() * rangeMs));
    }
  } else if (statusType === 'active') {
    for (let i = 0; i < count; i++) {
      const start = new Date('2026-01-01');
      const end = new Date('2026-02-28');
      const rangeMs = end.getTime() - start.getTime();
      dates.push(new Date(start.getTime() + Math.random() * rangeMs));
    }
  }

  return dates;
}

const COMPLETION_NOTES = [
  'Job completed satisfactorily. All parameters within normal limits.',
  'Work carried out as per maker\'s instructions. Equipment tested and found satisfactory.',
  'Inspection completed. No abnormalities found. Equipment in good condition.',
  'Maintenance carried out. All worn parts replaced. Equipment tested and found in order.',
  'Service completed. Oil samples taken for analysis. Equipment running normally.',
  'Overhaul completed. All clearances within maker\'s tolerance. Equipment tested under load.',
  'Calibration carried out. All readings within acceptable range.',
  'Visual inspection completed. Minor corrosion noted and treated. Equipment serviceable.',
  'Routine check completed. Equipment in satisfactory condition.',
  'Renewal completed. Old parts retained for inspection. New parts fitted and tested.',
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('=== Phase 1b: Generate 700 Additional Work Orders for Vessel 3 ===\n');

    const jobsResult = await pool.query(`
      SELECT j.id as job_id, j.component_name, j.component_code, j.job_no, j.job_title,
        j.assigned_to, j.maintenance_basis, j.frequency_value, j.frequency_unit,
        j.interval_running_hour, j.job_priority, j.class_related, j.sfi_code,
        COALESCE(wo_counts.cnt, 0) as existing_wo_count
      FROM jobs j
      LEFT JOIN (
        SELECT job_id, COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 GROUP BY job_id
      ) wo_counts ON wo_counts.job_id = j.id
      WHERE j.vessel_id = $1
      ORDER BY existing_wo_count ASC, j.component_code
    `, [VESSEL_ID]);

    const jobs = jobsResult.rows;
    console.log(`Found ${jobs.length} jobs for vessel`);
    const zeroWOJobs = jobs.filter(j => parseInt(j.existing_wo_count) === 0);
    console.log(`Jobs with 0 existing WOs: ${zeroWOJobs.length}`);

    const jobWOAllocation = [];
    let totalAllocated = 0;

    for (const job of jobs) {
      const existingCount = parseInt(job.existing_wo_count) || 0;
      const maxWOs = getMaxWOsForJob(job);
      const remainingCapacity = Math.max(0, maxWOs - existingCount);

      let allocate = 0;
      if (existingCount === 0) {
        allocate = Math.min(remainingCapacity, Math.max(1, Math.ceil(maxWOs * 0.5)));
      } else if (remainingCapacity > 0) {
        allocate = Math.min(remainingCapacity, Math.ceil(maxWOs * 0.3));
      }

      if (allocate > 0 && totalAllocated < TARGET_WOS) {
        const toAdd = Math.min(allocate, TARGET_WOS - totalAllocated);
        jobWOAllocation.push({ job, count: toAdd });
        totalAllocated += toAdd;
      }
    }

    if (totalAllocated < TARGET_WOS) {
      let deficit = TARGET_WOS - totalAllocated;
      let idx = 0;
      while (deficit > 0 && idx < jobs.length) {
        const job = jobs[idx % jobs.length];
        const existing = jobWOAllocation.find(a => a.job.job_id === job.job_id);
        if (existing) {
          existing.count++;
        } else {
          jobWOAllocation.push({ job, count: 1 });
        }
        totalAllocated++;
        deficit--;
        idx++;
      }
    }

    console.log(`Total WOs allocated across ${jobWOAllocation.length} jobs: ${totalAllocated}\n`);

    const crewAssignments = [];
    for (const crew of CREW_DISTRIBUTION) {
      for (let i = 0; i < crew.count; i++) {
        crewAssignments.push(crew.name);
      }
    }
    for (let i = crewAssignments.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [crewAssignments[i], crewAssignments[j]] = [crewAssignments[j], crewAssignments[i]];
    }

    const statusSlots = [];
    for (let i = 0; i < STATUS_DISTRIBUTION.completed; i++) statusSlots.push('completed');
    for (let i = 0; i < STATUS_DISTRIBUTION.overdue; i++) statusSlots.push('overdue');
    for (let i = 0; i < STATUS_DISTRIBUTION.dueGrace; i++) statusSlots.push('dueGrace');
    for (let i = 0; i < STATUS_DISTRIBUTION.active; i++) statusSlots.push('active');
    for (let i = statusSlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [statusSlots[i], statusSlots[j]] = [statusSlots[j], statusSlots[i]];
    }

    const workOrders = [];
    let woIdx = 0;

    for (const alloc of jobWOAllocation) {
      const { job, count } = alloc;

      for (let i = 0; i < count; i++) {
        if (woIdx >= TARGET_WOS) break;

        const statusType = statusSlots[woIdx] || 'completed';
        const crewName = crewAssignments[woIdx] || 'Chief Engineer';

        const dueDates = generateDueDatesForJob(job, 1, statusType);
        const dueDate = dueDates[0];
        const year = dueDate.getFullYear();

        const wo = {
          id: generateId(),
          vessel_id: VESSEL_ID,
          component: job.component_name,
          component_code: job.component_code,
          job_id: job.job_id,
          work_order_no: generateWONumber(job.job_no, job.component_code, year),
          work_order_type: 'Standard',
          job_title: job.job_title,
          assigned_to: crewName,
          due_date: formatDateDMY(dueDate),
          status: null,
          task_type: 'Maintenance',
          maintenance_type: 'Planned',
          maintenance_basis: job.maintenance_basis,
          frequency_value: job.frequency_value,
          frequency_unit: job.frequency_unit,
          job_priority: job.job_priority || 'Medium',
          class_related: job.class_related,
          sfi_code: job.sfi_code,
          is_execution: false,
          data_scope: 'vessel',
          was_rejected: false,
          driver_type: (job.maintenance_basis || '').toLowerCase().includes('running') ? 'running_hours' : 'calendar',
        };

        if (statusType === 'completed') {
          wo.status = 'Completed';
          const completionDays = 1 + Math.floor(Math.random() * 14);
          const completionDate = new Date(dueDate);
          completionDate.setDate(completionDate.getDate() + completionDays);
          wo.date_completed = formatDateDMY(completionDate);
          wo.completion_remarks = COMPLETION_NOTES[Math.floor(Math.random() * COMPLETION_NOTES.length)];
          wo.approval_action = 'Approved';
          wo.approver = 'Chief Engineer';
          const approvalDate = new Date(completionDate);
          approvalDate.setDate(approvalDate.getDate() + 1 + Math.floor(Math.random() * 3));
          wo.approval_date = formatDateDMY(approvalDate);

          const startDate = new Date(dueDate);
          startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 3));
          wo.start_date_time = formatDateDMY(startDate);
          wo.completion_date_time = formatDateDMY(completionDate);

          const hours = (0.5 + Math.random() * 8).toFixed(1);
          wo.total_time_hours = hours;
          wo.manhours = (parseFloat(hours) * (0.8 + Math.random() * 0.4)).toFixed(1);

          const createdDate = new Date(dueDate);
          createdDate.setDate(createdDate.getDate() - 7 - Math.floor(Math.random() * 14));
          wo.created_at = createdDate;
          wo.updated_at = completionDate;
        } else if (statusType === 'overdue') {
          wo.status = 'Overdue';
          const createdDate = new Date(dueDate);
          createdDate.setDate(createdDate.getDate() - 7 - Math.floor(Math.random() * 14));
          wo.created_at = createdDate;
          wo.updated_at = createdDate;
        } else if (statusType === 'dueGrace') {
          wo.status = 'Due (Grace P)';
          const createdDate = new Date(dueDate);
          createdDate.setDate(createdDate.getDate() - 7 - Math.floor(Math.random() * 14));
          wo.created_at = createdDate;
          wo.updated_at = createdDate;
        } else if (statusType === 'active') {
          wo.status = 'Active';
          const createdDate = new Date(dueDate);
          createdDate.setDate(createdDate.getDate() - 7 - Math.floor(Math.random() * 7));
          wo.created_at = createdDate;
          wo.updated_at = createdDate;
        }

        workOrders.push(wo);
        woIdx++;
      }
    }

    console.log(`Generated ${workOrders.length} work orders\n`);

    const statusCounts = {};
    const crewCounts = {};
    for (const wo of workOrders) {
      statusCounts[wo.status] = (statusCounts[wo.status] || 0) + 1;
      crewCounts[wo.assigned_to] = (crewCounts[wo.assigned_to] || 0) + 1;
    }

    console.log('Status Distribution:');
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  ${status}: ${count}`);
    }

    console.log('\nCrew Distribution (new WOs only):');
    for (const [crew, count] of Object.entries(crewCounts)) {
      console.log(`  ${crew}: ${count}`);
    }

    console.log('\n--- Inserting Work Orders in batches of', BATCH_SIZE, '---');
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < workOrders.length; i += BATCH_SIZE) {
      const batch = workOrders.slice(i, i + BATCH_SIZE);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const wo of batch) {
        const placeholders = [];
        const woParams = [
          wo.id, wo.vessel_id, wo.component, wo.component_code, wo.job_id,
          wo.work_order_no, wo.work_order_type, wo.job_title, wo.assigned_to,
          wo.due_date, wo.status, wo.task_type, wo.maintenance_type, wo.maintenance_basis,
          wo.frequency_value || null, wo.frequency_unit || null,
          wo.job_priority, wo.class_related || null, wo.sfi_code || null,
          wo.is_execution, wo.data_scope, wo.was_rejected, wo.driver_type,
          wo.date_completed || null, wo.completion_remarks || null,
          wo.approval_action || null, wo.approver || null, wo.approval_date || null,
          wo.start_date_time || null, wo.completion_date_time || null,
          wo.total_time_hours || null, wo.manhours || null,
          wo.created_at || new Date(), wo.updated_at || new Date(),
        ];

        for (let p = 0; p < woParams.length; p++) {
          placeholders.push(`$${paramIdx}`);
          paramIdx++;
        }
        values.push(`(${placeholders.join(',')})`);
        params.push(...woParams);
      }

      const sql = `
        INSERT INTO work_orders (
          id, vessel_id, component, component_code, job_id,
          work_order_no, work_order_type, job_title, assigned_to,
          due_date, status, task_type, maintenance_type, maintenance_basis,
          frequency_value, frequency_unit,
          job_priority, class_related, sfi_code,
          is_execution, data_scope, was_rejected, driver_type,
          date_completed, completion_remarks,
          approval_action, approver, approval_date,
          start_date_time, completion_date_time,
          total_time_hours, manhours,
          created_at, updated_at
        ) VALUES ${values.join(', ')}
        ON CONFLICT (id) DO NOTHING
      `;

      try {
        const result = await pool.query(sql, params);
        inserted += result.rowCount;
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${result.rowCount}/${batch.length}`);
      } catch (err) {
        console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${err.message}`);
        for (const wo of batch) {
          try {
            await pool.query(`
              INSERT INTO work_orders (
                id, vessel_id, component, component_code, job_id,
                work_order_no, work_order_type, job_title, assigned_to,
                due_date, status, task_type, maintenance_type, maintenance_basis,
                frequency_value, frequency_unit,
                job_priority, class_related, sfi_code,
                is_execution, data_scope, was_rejected, driver_type,
                date_completed, completion_remarks,
                approval_action, approver, approval_date,
                start_date_time, completion_date_time,
                total_time_hours, manhours,
                created_at, updated_at
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
              ON CONFLICT (id) DO NOTHING
            `, [
              wo.id, wo.vessel_id, wo.component, wo.component_code, wo.job_id,
              wo.work_order_no, wo.work_order_type, wo.job_title, wo.assigned_to,
              wo.due_date, wo.status, wo.task_type, wo.maintenance_type, wo.maintenance_basis,
              wo.frequency_value || null, wo.frequency_unit || null,
              wo.job_priority, wo.class_related || null, wo.sfi_code || null,
              wo.is_execution, wo.data_scope, wo.was_rejected, wo.driver_type,
              wo.date_completed || null, wo.completion_remarks || null,
              wo.approval_action || null, wo.approver || null, wo.approval_date || null,
              wo.start_date_time || null, wo.completion_date_time || null,
              wo.total_time_hours || null, wo.manhours || null,
              wo.created_at || new Date(), wo.updated_at || new Date(),
            ]);
            inserted++;
          } catch (innerErr) {
            if (innerErr.code === '23505') {
              skipped++;
            } else {
              console.error(`    Error inserting WO ${wo.work_order_no}: ${innerErr.message}`);
            }
          }
        }
      }
    }

    console.log(`\n=== COMPLETE ===`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Skipped (duplicates): ${skipped}`);

    console.log('\n--- Verification ---');
    const verify = await pool.query(
      `SELECT status, COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 GROUP BY status ORDER BY cnt DESC`,
      [VESSEL_ID]
    );
    console.log('Total WO counts by status:');
    let total = 0;
    for (const row of verify.rows) {
      console.log(`  ${row.status}: ${row.cnt}`);
      total += parseInt(row.cnt);
    }
    console.log(`  TOTAL: ${total}`);

    const crewVerify = await pool.query(
      `SELECT assigned_to, COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 GROUP BY assigned_to ORDER BY cnt DESC`,
      [VESSEL_ID]
    );
    console.log('\nTotal WO counts by crew:');
    for (const row of crewVerify.rows) {
      console.log(`  ${row.assigned_to}: ${row.cnt} (${(parseInt(row.cnt) / total * 100).toFixed(1)}%)`);
    }

  } catch (err) {
    console.error('Fatal error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
