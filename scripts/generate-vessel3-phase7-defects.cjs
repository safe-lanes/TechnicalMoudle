const { Pool } = require('pg');

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const START_DATE = new Date('2023-02-13');
const END_DATE = new Date('2026-02-13');

const CREW = {
  chief_eng: { id: '228b5256-5bd2-4bf3-826f-c6fe76571449', name: 'Chief Engineer', rank: 'Chief Engineer' },
  second_eng: { id: '056a433e-b880-43c6-9d59-b1cfe71a4014', name: '2nd Engineer', rank: '2nd Engineer' },
  third_eng: { id: '6084f3b8-85dc-462a-b045-111d2b2e6d0e', name: '3rd Engineer', rank: '3rd Engineer' },
  fourth_eng: { id: '480b40d0-04bd-4590-a936-2f879b867977', name: '4th Engineer', rank: '4th Engineer' },
  electrician: { id: '977621de-77d7-4892-ae27-adaebcc27d0b', name: 'Electrical Engineer', rank: 'Electrical Engineer' },
  master: { id: '6b12d69e-b7a9-4903-983d-ee00193f4870', name: 'Master', rank: 'MASTER' },
};

const DEFECT_CATEGORIES = ['Mechanical', 'Electrical', 'Structural', 'Safety', 'Navigation', 'Piping', 'Instrumentation'];
const DEFECT_TYPES = ['Breakdown', 'Wear & Tear', 'Corrosion', 'Leakage', 'Vibration', 'Overheating', 'Malfunction', 'Fatigue Failure'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const SEVERITIES = [1, 2, 3, 4, 5];

const DEFECT_SCENARIOS = [
  { desc: 'Main engine exhaust valve seat found worn beyond maker limits during routine inspection.', cat: 'Mechanical', dept: 'Engine', equip_cat: 'Main Engine', equip_type: 'Exhaust Valve', priority: 'High' },
  { desc: 'Auxiliary engine #2 turbocharger bearing clearance exceeding limits. Unusual noise observed.', cat: 'Mechanical', dept: 'Engine', equip_cat: 'Auxiliary Engine', equip_type: 'Turbocharger', priority: 'High' },
  { desc: 'FO purifier #1 bowl seal leaking. Seal replacement required.', cat: 'Mechanical', dept: 'Engine', equip_cat: 'Purifier', equip_type: 'Bowl Seal', priority: 'Medium' },
  { desc: 'Main switchboard circuit breaker tripping intermittently on generator #3. Investigation required.', cat: 'Electrical', dept: 'Engine', equip_cat: 'Electrical System', equip_type: 'Circuit Breaker', priority: 'High' },
  { desc: 'Emergency generator failed to start during weekly test. Starter motor suspected faulty.', cat: 'Electrical', dept: 'Engine', equip_cat: 'Emergency Equipment', equip_type: 'Starter Motor', priority: 'High' },
  { desc: 'Ballast pump #2 mechanical seal leaking. Replacement seal on order.', cat: 'Mechanical', dept: 'Engine', equip_cat: 'Pump', equip_type: 'Mechanical Seal', priority: 'Medium' },
  { desc: 'Steering gear hydraulic oil system pressure fluctuation. Investigating potential air leak.', cat: 'Mechanical', dept: 'Engine', equip_cat: 'Steering Gear', equip_type: 'Hydraulic System', priority: 'High' },
  { desc: 'Fire detection system zone 4 showing intermittent false alarms. Sensor cleaning required.', cat: 'Safety', dept: 'Engine', equip_cat: 'Fire Safety', equip_type: 'Smoke Detector', priority: 'High' },
  { desc: 'Accommodation ventilation fan bearing noise. Bearing replacement planned for next port.', cat: 'Mechanical', dept: 'Engine', equip_cat: 'HVAC', equip_type: 'Fan Bearing', priority: 'Low' },
  { desc: 'ME cooling water temperature sensor giving erratic readings. Calibration/replacement needed.', cat: 'Instrumentation', dept: 'Engine', equip_cat: 'Instrumentation', equip_type: 'Temperature Sensor', priority: 'Medium' },
  { desc: 'Deck crane wire rope showing signs of bird-caging. Inspection and potential renewal required.', cat: 'Structural', dept: 'Deck', equip_cat: 'Cargo Equipment', equip_type: 'Wire Rope', priority: 'Medium' },
  { desc: 'GMDSS battery capacity below required minimum during weekly test.', cat: 'Navigation', dept: 'Deck', equip_cat: 'Communication', equip_type: 'Battery', priority: 'High' },
  { desc: 'Radar scanner S-band intermittent picture loss during heavy rain.', cat: 'Navigation', dept: 'Deck', equip_cat: 'Navigation', equip_type: 'Radar Scanner', priority: 'Medium' },
  { desc: 'CO2 system pilot cylinder pressure found low during monthly check.', cat: 'Safety', dept: 'Engine', equip_cat: 'Fire Safety', equip_type: 'CO2 Cylinder', priority: 'High' },
  { desc: 'Sea water cooling pipe corrosion found during engine room rounds. Temporary repair applied.', cat: 'Piping', dept: 'Engine', equip_cat: 'Piping', equip_type: 'Cooling Pipe', priority: 'Medium' },
  { desc: 'Oily water separator not achieving 15ppm discharge standard. Coalescers require replacement.', cat: 'Mechanical', dept: 'Engine', equip_cat: 'Environmental', equip_type: 'OWS', priority: 'High' },
  { desc: 'Main engine fuel injection pump timing found off during routine check. Recalibration required.', cat: 'Mechanical', dept: 'Engine', equip_cat: 'Main Engine', equip_type: 'Fuel Pump', priority: 'High' },
  { desc: 'Cargo valve actuator not responding to remote command. Manual operation confirmed working.', cat: 'Mechanical', dept: 'Deck', equip_cat: 'Cargo System', equip_type: 'Valve Actuator', priority: 'Medium' },
  { desc: 'Boiler feed water pump vibration levels above normal. Alignment check required.', cat: 'Mechanical', dept: 'Engine', equip_cat: 'Boiler', equip_type: 'Feed Pump', priority: 'Medium' },
  { desc: 'Lifeboat engine failed to start during monthly drill. Fuel system suspected.', cat: 'Safety', dept: 'Deck', equip_cat: 'Life Saving', equip_type: 'Lifeboat Engine', priority: 'High' },
];

const STATUSES_CLOSED = ['Closed', 'Verified & Closed'];
const STATUSES_OPEN = ['Open', 'Under Investigation', 'Under Repair'];
const STATUSES_PENDING = ['Pending Spare Parts', 'Under Repair'];

function formatDateDMY(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function generateDefectId(vesselSeq, year, seq) {
  return `DEF-V${vesselSeq}-${String(year).slice(-2)}-${String(seq).padStart(4,'0')}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('=== Phase 7: Defects Log Generation ===');
    
    const componentsResult = await pool.query(
      `SELECT id, component_code, name, department FROM components WHERE vessel_id = $1 LIMIT 100`,
      [VESSEL_ID]
    );
    const components = componentsResult.rows;
    
    const totalDefects = 80 + Math.floor(Math.random() * 40);
    console.log(`Generating ${totalDefects} defects`);
    
    let defectSeq = 1;
    let closedCount = 0, openCount = 0, pendingCount = 0;
    
    for (let i = 0; i < totalDefects; i++) {
      const dayOffset = Math.floor(Math.random() * 1096);
      const issueDate = new Date(START_DATE);
      issueDate.setDate(issueDate.getDate() + dayOffset);
      
      const scenario = DEFECT_SCENARIOS[i % DEFECT_SCENARIOS.length];
      const comp = components[Math.floor(Math.random() * components.length)];
      const raisedBy = Object.values(CREW)[Math.floor(Math.random() * 5)];
      
      const year = issueDate.getFullYear();
      const defectId = generateDefectId(3, year, defectSeq++);
      
      let status, dateCompleted = null, closedBy = null, closedOn = null, closureComment = null;
      let verifiedDate = null, verifiedByName = null;
      const daysFromNow = Math.floor((END_DATE - issueDate) / (1000 * 60 * 60 * 24));
      
      if (daysFromNow > 90) {
        status = STATUSES_CLOSED[Math.floor(Math.random() * STATUSES_CLOSED.length)];
        closedCount++;
        const completionDays = 3 + Math.floor(Math.random() * 60);
        const completionDate = new Date(issueDate);
        completionDate.setDate(completionDate.getDate() + completionDays);
        dateCompleted = formatDateDMY(completionDate);
        closedBy = CREW.chief_eng.id;
        closedOn = formatDateDMY(new Date(completionDate.getTime() + 86400000 * (1 + Math.floor(Math.random() * 3))));
        closureComment = 'Defect rectified and verified. Equipment tested satisfactorily.';
        verifiedDate = closedOn;
        verifiedByName = 'Chief Engineer';
      } else if (daysFromNow > 30) {
        status = STATUSES_PENDING[Math.floor(Math.random() * STATUSES_PENDING.length)];
        pendingCount++;
      } else {
        status = STATUSES_OPEN[Math.floor(Math.random() * STATUSES_OPEN.length)];
        openCount++;
      }
      
      const targetCloseDate = new Date(issueDate);
      targetCloseDate.setDate(targetCloseDate.getDate() + 14 + Math.floor(Math.random() * 30));
      
      try {
        await pool.query(
          `INSERT INTO defects (
            id, vessel_id, vessel_name, issue_date, category, defect_type,
            description, description_text, status, priority, critical, severity,
            equipment_category, equipment_type, component_id, responsible_dept,
            target_close_date, date_completed, raised_by_id, raised_by_name, raised_by_rank,
            assigned_to, reviewed_by, closed_by, closed_on, closure_comment,
            verified_date, verified_by_name, verified, reported_by,
            actions, attachments, audit_trail, notes,
            is_coc, is_deferred, report_to_third_party, class_report, flag_report, port_report,
            created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
            '[]'::json, '[]'::json, '[]'::json, '[]'::json,
            false, false, false, false, false, false,
            $31,$32
          )`,
          [
            defectId, VESSEL_ID, 'Vessel 3', formatDateDMY(issueDate),
            scenario.cat, DEFECT_TYPES[Math.floor(Math.random() * DEFECT_TYPES.length)],
            scenario.desc, scenario.desc,
            status, scenario.priority, scenario.priority === 'High', 
            SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)],
            scenario.equip_cat, scenario.equip_type, comp.id, scenario.dept,
            formatDateDMY(targetCloseDate), dateCompleted,
            raisedBy.id, raisedBy.name, raisedBy.rank,
            CREW.second_eng.name, CREW.chief_eng.name,
            closedBy, closedOn, closureComment,
            verifiedDate, verifiedByName, !!verifiedDate, raisedBy.name,
            issueDate, issueDate
          ]
        );
      } catch (err) {
        console.error(`Error inserting defect ${defectId}: ${err.message}`);
      }
    }
    
    console.log(`\n=== COMPLETE ===`);
    console.log(`Total defects: ${totalDefects}`);
    console.log(`  Closed: ${closedCount}`);
    console.log(`  Pending: ${pendingCount}`);
    console.log(`  Open: ${openCount}`);
    
    const verify = await pool.query(
      `SELECT status, COUNT(*) as cnt FROM defects WHERE vessel_id = $1 GROUP BY status`,
      [VESSEL_ID]
    );
    console.log('\nVerification:');
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

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
