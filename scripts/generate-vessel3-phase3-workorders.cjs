const { Pool } = require('pg');

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const START_DATE = new Date('2023-02-13');
const END_DATE = new Date('2026-02-13');
const TODAY = new Date('2026-02-13');
const BATCH_SIZE = 500;

const CREW = {
  chief_eng: '228b5256-5bd2-4bf3-826f-c6fe76571449',
  second_eng: '056a433e-b880-43c6-9d59-b1cfe71a4014',
  third_eng: '6084f3b8-85dc-462a-b045-111d2b2e6d0e',
  fourth_eng: '480b40d0-04bd-4590-a936-2f879b867977',
  electrician: '977621de-77d7-4892-ae27-adaebcc27d0b',
  master: '6b12d69e-b7a9-4903-983d-ee00193f4870',
};

const ASSIGNED_MAP = {
  'Chief Engineer': 'Chief Engineer',
  '2nd Engineer': '2nd Engineer',
  '3rd Engineer': '3rd Engineer',
  '4th Engineer': '4th Engineer',
  '2nd Officer': '2nd Officer',
  'Electrical Engineer': 'Electrical Engineer',
};

const STATUS_COMPLETED = 'Completed';
const STATUS_OVERDUE = 'Overdue';
const STATUS_ACTIVE = 'Active';
const STATUS_DUE_GRACE = 'Due (Grace P)';

function formatDateDMY(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function addInterval(date, value, unit) {
  const d = new Date(date);
  const v = parseInt(value) || 1;
  if (unit === 'Weeks') d.setDate(d.getDate() + v * 7);
  else if (unit === 'Months') d.setMonth(d.getMonth() + v);
  else if (unit === 'Years') d.setFullYear(d.getFullYear() + v);
  else if (unit === 'Days') d.setDate(d.getDate() + v);
  return d;
}

function parseDate(str) {
  if (!str) return null;
  const months = {'Jan':0,'Feb':1,'Mar':2,'Apr':3,'May':4,'Jun':5,'Jul':6,'Aug':7,'Sep':8,'Oct':9,'Nov':10,'Dec':11};
  const parts = str.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), months[parts[1]] || 0, parseInt(parts[0]));
  }
  return new Date(str);
}

function generateId() {
  return `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

let woCounter = 0;
function generateWONumber(compCode, year, type) {
  woCounter++;
  const prefix = type === 'breakdown' ? 'UWO' : 'WO';
  return `${prefix}-${compCode}-${year}-${String(woCounter).padStart(3,'0')}`;
}

const BREAKDOWN_SCENARIOS = [
  { title: 'Pump Seal Failure - Emergency Repair', desc: 'Pump seal found leaking during routine watch. Emergency repair carried out.', priority: 'High' },
  { title: 'Valve Leakage - Immediate Repair', desc: 'Valve found leaking during rounds. Repacked gland and replaced gasket.', priority: 'High' },
  { title: 'Electrical Fault - Motor Trip', desc: 'Motor tripped on overload. Investigated and rectified fault.', priority: 'High' },
  { title: 'Sensor Failure - Replacement', desc: 'Temperature/pressure sensor giving erratic readings. Replaced sensor.', priority: 'High' },
  { title: 'Pipe Leakage - Welding Repair', desc: 'Pipe leakage found in engine room. Temporary repair carried out, permanent repair planned.', priority: 'High' },
  { title: 'Alarm Investigation - System Check', desc: 'Investigated alarm. Found faulty sensor/connection. Rectified.', priority: 'Medium' },
  { title: 'Bearing Overheating - Emergency Maintenance', desc: 'Bearing temperature rising above normal. Emergency maintenance carried out.', priority: 'High' },
  { title: 'Filter Blockage - Emergency Cleaning', desc: 'Filter differential pressure high. Emergency cleaning/replacement carried out.', priority: 'Medium' },
  { title: 'Hydraulic System Pressure Drop', desc: 'Hydraulic system pressure dropping. Investigated and found leaking fitting. Repaired.', priority: 'High' },
  { title: 'Cooling System Malfunction', desc: 'Cooling water temperature rising. Investigated and cleaned heat exchanger.', priority: 'High' },
  { title: 'Fuel System Contamination', desc: 'Fuel oil contamination detected. Purifier and filters cleaned/replaced.', priority: 'High' },
  { title: 'Control System Malfunction', desc: 'Control system showing intermittent faults. Checked connections and calibrated.', priority: 'Medium' },
];

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
    console.log('=== Phase 3: Work Orders Generation ===');
    
    const jobsResult = await pool.query(
      `SELECT id, component_id, component_code, component_name, job_no, job_title, assigned_to, 
              maintenance_basis, frequency_value, frequency_unit, interval_running_hour,
              last_done_date, next_due_date, job_priority, department, brief_work_description,
              required_spare_parts, required_tools, safety_requirements
       FROM jobs WHERE vessel_id = $1`,
      [VESSEL_ID]
    );
    
    const jobs = jobsResult.rows;
    console.log(`Found ${jobs.length} job templates`);
    
    const calendarJobs = jobs.filter(j => j.maintenance_basis === 'Calendar');
    const rhJobs = jobs.filter(j => j.maintenance_basis === 'Running Hours');
    console.log(`  Calendar-based: ${calendarJobs.length}`);
    console.log(`  Running Hours-based: ${rhJobs.length}`);
    
    const componentsResult = await pool.query(
      `SELECT id, component_code, name, department, rh_counter_type, current_cumulative_rh 
       FROM components WHERE vessel_id = $1`,
      [VESSEL_ID]
    );
    const components = componentsResult.rows;
    console.log(`Found ${components.length} components`);
    
    const rhDataResult = await pool.query(
      `SELECT component_id, cumulative_rh::numeric as rh, date_updated_local 
       FROM running_hours_audit WHERE vessel_id = $1 
       ORDER BY component_id, entered_at_utc`,
      [VESSEL_ID]
    );
    
    const rhByComponent = {};
    for (const row of rhDataResult.rows) {
      if (!rhByComponent[row.component_id]) rhByComponent[row.component_id] = [];
      rhByComponent[row.component_id].push({ rh: parseFloat(row.rh), date: row.date_updated_local });
    }
    console.log(`Loaded running hours data for ${Object.keys(rhByComponent).length} components`);
    
    const workOrders = [];
    
    console.log('\n--- Generating Calendar-Based Work Orders ---');
    for (const job of calendarJobs) {
      if (!job.frequency_value || !job.frequency_unit) continue;
      
      let lastDone = job.last_done_date ? parseDate(job.last_done_date) : null;
      if (!lastDone || lastDone < START_DATE) {
        lastDone = new Date(START_DATE);
        lastDone.setDate(lastDone.getDate() - Math.floor(Math.random() * 30));
      }
      
      let dueDate = addInterval(lastDone, job.frequency_value, job.frequency_unit);
      
      while (dueDate < END_DATE) {
        const wo = createWorkOrder(job, dueDate, 'Planned', 'Calendar');
        workOrders.push(wo);
        lastDone = dueDate;
        dueDate = addInterval(lastDone, job.frequency_value, job.frequency_unit);
      }
    }
    console.log(`  Calendar WOs generated: ${workOrders.length}`);
    
    const calCount = workOrders.length;
    console.log('\n--- Generating Running Hours-Based Work Orders ---');
    for (const job of rhJobs) {
      const interval = parseInt(job.interval_running_hour) || parseInt(job.frequency_value) || 0;
      if (interval <= 0) continue;
      
      const rhData = rhByComponent[job.component_id];
      if (!rhData || rhData.length === 0) continue;
      
      let lastDoneRH = parseInt(job.last_done_rh) || 0;
      let nextDueRH = lastDoneRH + interval;
      
      for (const entry of rhData) {
        if (entry.rh >= nextDueRH) {
          const dueDate = parseDate(entry.date.split(' ')[0]);
          if (dueDate && dueDate >= START_DATE && dueDate < END_DATE) {
            const wo = createWorkOrder(job, dueDate, 'Planned', 'Running Hours');
            wo.running_hours = entry.rh.toFixed(2);
            wo.current_reading = entry.rh.toFixed(2);
            wo.previous_reading = lastDoneRH.toFixed(2);
            wo.running_hours_difference = (entry.rh - lastDoneRH).toFixed(2);
            wo.driver_type = 'running_hours';
            wo.due_rh_snapshot = nextDueRH;
            wo.effective_rh_at_generation = entry.rh;
            wo.rh_last_done_snapshot = lastDoneRH;
            workOrders.push(wo);
            lastDoneRH = entry.rh;
            nextDueRH = lastDoneRH + interval;
          }
        }
      }
    }
    console.log(`  RH WOs generated: ${workOrders.length - calCount}`);
    
    const preBreakdownCount = workOrders.length;
    console.log('\n--- Generating Breakdown/Unplanned Work Orders ---');
    const breakdownCount = 300 + Math.floor(Math.random() * 150);
    for (let i = 0; i < breakdownCount; i++) {
      const comp = components[Math.floor(Math.random() * components.length)];
      const dayOffset = Math.floor(Math.random() * 1096);
      const issueDate = new Date(START_DATE);
      issueDate.setDate(issueDate.getDate() + dayOffset);
      
      if (issueDate >= END_DATE) continue;
      
      const scenario = BREAKDOWN_SCENARIOS[Math.floor(Math.random() * BREAKDOWN_SCENARIOS.length)];
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 1 + Math.floor(Math.random() * 6));
      
      const wo = {
        id: generateId(),
        vessel_id: VESSEL_ID,
        component: comp.name,
        component_code: comp.component_code,
        job_id: null,
        work_order_no: generateWONumber(comp.component_code, issueDate.getFullYear(), 'breakdown'),
        work_order_type: 'Unplanned',
        job_title: `${comp.name} - ${scenario.title}`,
        assigned_to: getAssignment(comp.department),
        due_date: formatDateDMY(dueDate),
        status: null,
        maintenance_type: 'Breakdown',
        maintenance_basis: 'Breakdown',
        job_priority: scenario.priority,
        brief_work_description: scenario.desc,
        department: comp.department || 'Engine',
        created_at: issueDate.toISOString(),
        updated_at: null,
      };
      
      workOrders.push(wo);
    }
    console.log(`  Breakdown WOs generated: ${workOrders.length - preBreakdownCount}`);
    
    console.log('\n--- Assigning Statuses ---');
    let completedOnTime = 0, completedLate = 0, overdue = 0, dueGrace = 0, active = 0;
    
    const targetOverdue = 139;
    const targetDueGrace = 9;
    
    workOrders.sort((a, b) => {
      const da = parseDate(a.due_date);
      const db = parseDate(b.due_date);
      return (da || new Date(0)) - (db || new Date(0));
    });
    
    let overdueAssigned = 0;
    let dueGraceAssigned = 0;
    
    for (const wo of workOrders) {
      const dueDate = parseDate(wo.due_date);
      if (!dueDate) {
        wo.status = STATUS_COMPLETED;
        continue;
      }
      
      if (dueDate > TODAY) {
        wo.status = STATUS_ACTIVE;
        active++;
        const createdDate = new Date(dueDate);
        createdDate.setDate(createdDate.getDate() - 7 - Math.floor(Math.random() * 7));
        wo.created_at = createdDate.toISOString();
        wo.updated_at = createdDate.toISOString();
        continue;
      }
      
      const daysFromToday = Math.floor((TODAY - dueDate) / (1000 * 60 * 60 * 24));
      
      if (daysFromToday <= 7 && daysFromToday >= 0 && dueGraceAssigned < targetDueGrace) {
        wo.status = STATUS_DUE_GRACE;
        dueGraceAssigned++;
        dueGrace++;
        const createdDate = new Date(dueDate);
        createdDate.setDate(createdDate.getDate() - 7);
        wo.created_at = createdDate.toISOString();
        wo.updated_at = createdDate.toISOString();
        continue;
      }
      
      if (daysFromToday > 0 && daysFromToday <= 90 && overdueAssigned < targetOverdue) {
        wo.status = STATUS_OVERDUE;
        overdueAssigned++;
        overdue++;
        const createdDate = new Date(dueDate);
        createdDate.setDate(createdDate.getDate() - 7);
        wo.created_at = createdDate.toISOString();
        wo.updated_at = createdDate.toISOString();
        continue;
      }
      
      const rand = Math.random();
      if (rand < 0.82) {
        wo.status = STATUS_COMPLETED;
        completedOnTime++;
        const completionOffset = Math.floor(Math.random() * 5) - 2;
        const completionDate = new Date(dueDate);
        completionDate.setDate(completionDate.getDate() + completionOffset);
        wo.date_completed = completionDate.toISOString();
        wo.completion_remarks = COMPLETION_NOTES[Math.floor(Math.random() * COMPLETION_NOTES.length)];
        wo.approval_date = formatDateDMY(new Date(completionDate.getTime() + 86400000 * (1 + Math.floor(Math.random() * 3))));
        wo.approver = 'Chief Engineer';
        wo.approval_action = 'Approved';
        
        const startDate = new Date(dueDate);
        startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 3));
        wo.start_date_time = formatDateDMY(startDate);
        wo.completion_date_time = formatDateDMY(completionDate);
        
        const plannedHours = getManHours(wo.maintenance_type || 'Inspection');
        wo.total_time_hours = String(plannedHours);
        wo.manhours = String((plannedHours * (0.8 + Math.random() * 0.4)).toFixed(1));
        
        const createdDate = new Date(dueDate);
        createdDate.setDate(createdDate.getDate() - 7 - Math.floor(Math.random() * 7));
        wo.created_at = createdDate.toISOString();
        wo.updated_at = completionDate.toISOString();
      } else if (rand < 0.97) {
        wo.status = STATUS_COMPLETED;
        completedLate++;
        const lateBy = 5 + Math.floor(Math.random() * 25);
        const completionDate = new Date(dueDate);
        completionDate.setDate(completionDate.getDate() + lateBy);
        wo.date_completed = completionDate.toISOString();
        wo.completion_remarks = COMPLETION_NOTES[Math.floor(Math.random() * COMPLETION_NOTES.length)];
        wo.approval_date = formatDateDMY(new Date(completionDate.getTime() + 86400000 * (1 + Math.floor(Math.random() * 3))));
        wo.approver = 'Chief Engineer';
        wo.approval_action = 'Approved';
        wo._wasLate = true;
        wo._originalDueDate = formatDateDMY(dueDate);
        
        const startDate = new Date(dueDate);
        startDate.setDate(startDate.getDate() + Math.floor(Math.random() * lateBy));
        wo.start_date_time = formatDateDMY(startDate);
        wo.completion_date_time = formatDateDMY(completionDate);
        
        const plannedHours = getManHours(wo.maintenance_type || 'Inspection');
        wo.total_time_hours = String(plannedHours);
        wo.manhours = String((plannedHours * (0.9 + Math.random() * 0.3)).toFixed(1));
        
        const createdDate = new Date(dueDate);
        createdDate.setDate(createdDate.getDate() - 7);
        wo.created_at = createdDate.toISOString();
        wo.updated_at = completionDate.toISOString();
      } else {
        if (overdueAssigned < targetOverdue + 20) {
          wo.status = STATUS_OVERDUE;
          overdueAssigned++;
          overdue++;
        } else {
          wo.status = STATUS_COMPLETED;
          completedOnTime++;
          const completionDate = new Date(dueDate);
          completionDate.setDate(completionDate.getDate() + 1);
          wo.date_completed = completionDate.toISOString();
          wo.completion_remarks = COMPLETION_NOTES[0];
          wo.created_at = new Date(dueDate.getTime() - 604800000).toISOString();
          wo.updated_at = completionDate.toISOString();
        }
      }
    }
    
    console.log(`Status distribution:`);
    console.log(`  Completed on time: ${completedOnTime}`);
    console.log(`  Completed late: ${completedLate}`);
    console.log(`  Overdue: ${overdue}`);
    console.log(`  Due (Grace P): ${dueGrace}`);
    console.log(`  Active/Open: ${active}`);
    console.log(`  Total: ${workOrders.length}`);
    
    console.log('\n--- Inserting Work Orders ---');
    let inserted = 0;
    let batch = [];
    
    for (const wo of workOrders) {
      batch.push(wo);
      if (batch.length >= BATCH_SIZE) {
        await insertWOBatch(pool, batch);
        inserted += batch.length;
        console.log(`  Progress: ${inserted}/${workOrders.length}`);
        batch = [];
      }
    }
    if (batch.length > 0) {
      await insertWOBatch(pool, batch);
      inserted += batch.length;
    }
    
    console.log(`\n=== COMPLETE ===`);
    console.log(`Total work orders inserted: ${inserted}`);
    
    const verify = await pool.query(
      `SELECT status, COUNT(*) as cnt FROM work_orders WHERE vessel_id = $1 GROUP BY status ORDER BY cnt DESC`,
      [VESSEL_ID]
    );
    console.log('\nVerification (all WOs for vessel):');
    for (const row of verify.rows) {
      console.log(`  ${row.status}: ${row.cnt}`);
    }
    
  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

function createWorkOrder(job, dueDate, woType, maintenanceBasis) {
  const year = dueDate.getFullYear();
  return {
    id: generateId(),
    vessel_id: VESSEL_ID,
    component: job.component_name,
    component_code: job.component_code,
    job_id: job.id,
    work_order_no: generateWONumber(job.component_code, year, 'planned'),
    work_order_type: woType,
    job_title: job.job_title,
    assigned_to: job.assigned_to || '2nd Engineer',
    due_date: formatDateDMY(dueDate),
    status: null,
    maintenance_type: job.maintenance_type || 'Inspection',
    maintenance_basis: maintenanceBasis,
    frequency_value: job.frequency_value,
    frequency_unit: job.frequency_unit,
    job_priority: job.job_priority || 'Medium',
    brief_work_description: job.brief_work_description || job.job_title,
    department: job.department || 'Engine',
    required_spare_parts: job.required_spare_parts,
    required_tools: job.required_tools,
    safety_requirements: job.safety_requirements,
    driver_type: maintenanceBasis === 'Running Hours' ? 'running_hours' : 'calendar',
    created_at: null,
    updated_at: null,
  };
}

function getAssignment(department) {
  if (department === 'Deck') return '2nd Officer';
  const roles = ['2nd Engineer', '2nd Engineer', '3rd Engineer', '3rd Engineer', '4th Engineer', 'Chief Engineer'];
  return roles[Math.floor(Math.random() * roles.length)];
}

function getManHours(maintenanceType) {
  const typeMap = {
    'Inspection': 0.5 + Math.random() * 1.5,
    'Service': 1 + Math.random() * 3,
    'Overhaul': 4 + Math.random() * 20,
    'Calibration': 0.5 + Math.random() * 1,
    'Replacement': 2 + Math.random() * 6,
    'Breakdown': 4 + Math.random() * 20,
  };
  return parseFloat((typeMap[maintenanceType] || (1 + Math.random() * 4)).toFixed(1));
}

async function insertWOBatch(pool, batch) {
  for (const wo of batch) {
    try {
      await pool.query(
        `INSERT INTO work_orders (
          id, vessel_id, component, component_code, job_id, work_order_no, work_order_type,
          job_title, assigned_to, due_date, status, maintenance_type, maintenance_basis,
          frequency_value, frequency_unit, job_priority, brief_work_description, department,
          date_completed, completion_remarks, approval_date, approver, approval_action,
          start_date_time, completion_date_time, total_time_hours, manhours,
          required_spare_parts, required_tools, safety_requirements,
          uploaded_documents, consumed_spare_parts,
          running_hours, current_reading, previous_reading, running_hours_difference,
          driver_type, due_rh_snapshot, effective_rh_at_generation, rh_last_done_snapshot,
          is_execution, data_scope, was_rejected,
          created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,
          $40,$41,$42,$43,$44,$45
        )`,
        [
          wo.id, wo.vessel_id, wo.component, wo.component_code, wo.job_id, wo.work_order_no,
          wo.work_order_type || 'Planned', wo.job_title, wo.assigned_to, wo.due_date, wo.status || 'Active',
          wo.maintenance_type, wo.maintenance_basis, wo.frequency_value, wo.frequency_unit,
          wo.job_priority, wo.brief_work_description, wo.department,
          wo.date_completed || null, wo.completion_remarks || null, wo.approval_date || null,
          wo.approver || null, wo.approval_action || null,
          wo.start_date_time || null, wo.completion_date_time || null,
          wo.total_time_hours || null, wo.manhours || null,
          wo.required_spare_parts ? JSON.stringify(wo.required_spare_parts) : '[]',
          wo.required_tools ? JSON.stringify(wo.required_tools) : '[]',
          wo.safety_requirements ? JSON.stringify(wo.safety_requirements) : '{"ppeRequirements":[],"permitRequirements":[],"otherRequirements":[]}',
          '[]', '[]',
          wo.running_hours || null, wo.current_reading || null, wo.previous_reading || null,
          wo.running_hours_difference || null, wo.driver_type || null,
          wo.due_rh_snapshot || null, wo.effective_rh_at_generation || null,
          wo.rh_last_done_snapshot || null,
          false, 'vessel', false,
          wo.created_at ? new Date(wo.created_at) : new Date(), wo.updated_at ? new Date(wo.updated_at) : new Date()
        ]
      );
    } catch (err) {
      if (err.code === '23505') continue;
      console.error(`Error inserting WO ${wo.work_order_no}: ${err.message}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
