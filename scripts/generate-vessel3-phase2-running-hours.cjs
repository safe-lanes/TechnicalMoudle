const { Pool } = require('pg');

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const START_DATE = new Date('2023-02-13');
const END_DATE = new Date('2026-02-13');
const BATCH_SIZE = 1000;

const CREW_USER_IDS = [
  { id: '228b5256-5bd2-4bf3-826f-c6fe76571449', designation: 'Chief Engineer' },
  { id: '056a433e-b880-43c6-9d59-b1cfe71a4014', designation: '2nd Engineer' },
  { id: '6084f3b8-85dc-462a-b045-111d2b2e6d0e', designation: '3rd Engineer' },
  { id: '480b40d0-04bd-4590-a936-2f879b867977', designation: '4th Engineer' },
  { id: '977621de-77d7-4892-ae27-adaebcc27d0b', designation: 'Electrical Engineer' },
];

const RH_COMPONENTS = [
  { id: 'COMP-1768374767818-ckg4kqu6q', code: '601.001', name: 'Main Diesel Engine, Compl.', type: 'main_engine', startRH: 6050 },
  { id: 'COMP-1768374767848-yixi06ueq', code: '651.001', name: 'Aux. Diesel Generator Aggregates, Complete No.01', type: 'aux_engine', startRH: 0 },
  { id: 'COMP-1768374767863-71ynjfqzw', code: '652.001', name: 'Aux. Diesel Generator Aggregates, Complete No.02', type: 'aux_engine', startRH: 0 },
  { id: 'COMP-1768374767879-whkjy1n4i', code: '653.001', name: 'Aux. Diesel Generator Aggregates, Complete No.03', type: 'aux_engine', startRH: 0 },
  { id: 'COMP-1768374767903-diu642k7j', code: '665.003', name: 'Emergency Generator Drive Units', type: 'emergency_gen', startRH: 0 },
  { id: 'COMP-1768374767834-dbncpiany', code: '601.053', name: 'ME Turbochargers', type: 'turbo_me', startRH: 0 },
  { id: 'COMP-1768374767859-rfmxd163z', code: '651.053', name: 'AE1 Turbochargers', type: 'turbo_ae', startRH: 0 },
  { id: 'COMP-1768374767875-8i4qk5eoo', code: '652.053', name: 'AE2 Turbochargers', type: 'turbo_ae', startRH: 0 },
  { id: 'COMP-1768374767895-uwp1jvxsi', code: '653.053', name: 'AE3 Turbochargers', type: 'turbo_ae', startRH: 0 },
  { id: 'COMP-1768374767845-490ayszf9', code: '601.064', name: 'ME Turning Gear', type: 'turning_gear', startRH: 0 },
  { id: 'COMP-1768374767962-b363j8iop', code: '554.003.01', name: 'Compressors W/Drive Unit No.01', type: 'compressor', startRH: 15035 },
  { id: 'COMP-1768374767967-jb4k6wuji', code: '554.003.02', name: 'Compressors W/Drive Unit No.02', type: 'compressor', startRH: 0 },
  { id: 'COMP-1768374768508-68ro7cn9f', code: '702.005.01', name: 'FO Separators No.01', type: 'separator', startRH: 0 },
  { id: 'COMP-1768374768511-709kv1bk1', code: '702.005.02', name: 'FO Separators No.02', type: 'separator', startRH: 0 },
  { id: 'COMP-1768374768521-2x58uv1ld', code: '712.011.01', name: 'LO Separators No.01', type: 'lo_separator', startRH: 0 },
  { id: 'COMP-1768374768525-zyps62yum', code: '712.011.02', name: 'LO Separators No.02', type: 'lo_separator', startRH: 0 },
  { id: 'COMP-1768374767815-k5anrfi02', code: '554.001', name: 'Provision Cooling Compressor Aggregates', type: 'reefer', startRH: 0 },
  { id: 'COMP-1768374767805-z4lpo0038', code: '411.001', name: 'S-Band Radar', type: 'nav', startRH: 0 },
  { id: 'COMP-1768374767809-mr8172nux', code: '411.002', name: 'X-Band Radar', type: 'nav', startRH: 0 },
];

function generatePortDays() {
  const portDays = new Set();
  let current = new Date(START_DATE);
  while (current < END_DATE) {
    const voyageDuration = 30 + Math.floor(Math.random() * 15);
    current.setDate(current.getDate() + voyageDuration);
    const portStay = 2 + Math.floor(Math.random() * 3);
    for (let d = 0; d < portStay && current < END_DATE; d++) {
      portDays.add(new Date(current).toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
  }
  return portDays;
}

function getDailyHours(compType, isPortDay) {
  const variance = () => (Math.random() - 0.5) * 2;
  if (compType === 'main_engine') {
    return isPortDay ? Math.max(0, 0.5 + Math.random() * 1.5) : Math.max(12, 18 + variance() * 2);
  }
  if (compType === 'aux_engine') {
    return isPortDay ? Math.max(4, 8 + variance()) : Math.max(6, 12 + variance() * 2);
  }
  if (compType === 'emergency_gen') {
    return isPortDay ? Math.max(0, 0.5 + Math.random()) : Math.max(0, 0.2 + Math.random() * 0.3);
  }
  if (compType === 'turbo_me') {
    return isPortDay ? Math.max(0, 0.3 + Math.random()) : Math.max(12, 17 + variance() * 2);
  }
  if (compType === 'turbo_ae') {
    return isPortDay ? Math.max(3, 7 + variance()) : Math.max(5, 10 + variance() * 2);
  }
  if (compType === 'turning_gear') {
    return isPortDay ? Math.max(0.5, 2 + Math.random()) : Math.max(0, 0.1 + Math.random() * 0.2);
  }
  if (compType === 'compressor') {
    return isPortDay ? Math.max(2, 4 + variance()) : Math.max(4, 8 + variance());
  }
  if (compType === 'separator') {
    return isPortDay ? Math.max(2, 6 + variance()) : Math.max(8, 14 + variance());
  }
  if (compType === 'lo_separator') {
    return isPortDay ? Math.max(2, 5 + variance()) : Math.max(6, 12 + variance());
  }
  if (compType === 'reefer') {
    return Math.max(10, 18 + variance() * 2);
  }
  if (compType === 'nav') {
    return isPortDay ? Math.max(1, 4 + variance()) : Math.max(18, 22 + variance());
  }
  return Math.max(2, 6 + variance());
}

function formatDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${months[d.getMonth()]}-${d.getFullYear()} 12:00`;
}

const REMARKS = [
  'Normal operation',
  'Normal operation',
  'Normal operation',
  'Normal operation',
  'Normal operation',
  'Smooth running',
  'All parameters normal',
  'Routine operation',
  null,
  null,
  null,
];

const PORT_REMARKS = [
  'Port - standby',
  'In port',
  'Port operations',
  'Alongside berth',
  'Loading/discharging operations',
];

const WEATHER_REMARKS = [
  'Heavy weather - reduced speed',
  'Adverse weather conditions',
  'Swell conditions - engine load fluctuation',
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('=== Phase 2: Running Hours Data Generation ===');
    console.log(`Period: ${START_DATE.toISOString().split('T')[0]} to ${END_DATE.toISOString().split('T')[0]}`);
    
    const existingCount = await pool.query(
      'SELECT COUNT(*) FROM running_hours_audit WHERE vessel_id = $1',
      [VESSEL_ID]
    );
    console.log(`Existing RH audit entries: ${existingCount.rows[0].count}`);
    
    const portDays = generatePortDays();
    console.log(`Generated ${portDays.size} port days over 3 years`);
    
    const totalDays = Math.ceil((END_DATE - START_DATE) / (1000 * 60 * 60 * 24));
    console.log(`Total days: ${totalDays}`);
    console.log(`Components: ${RH_COMPONENTS.length}`);
    console.log(`Estimated entries: ${totalDays * RH_COMPONENTS.length}`);
    
    let totalInserted = 0;
    let batch = [];
    
    for (const comp of RH_COMPONENTS) {
      let cumulativeRH = comp.startRH;
      let prevRH = comp.startRH;
      let dayCount = 0;
      
      let current = new Date(START_DATE);
      while (current < END_DATE) {
        const dateStr = current.toISOString().split('T')[0];
        const isPort = portDays.has(dateStr);
        const dailyHours = parseFloat(getDailyHours(comp.type, isPort).toFixed(2));
        
        prevRH = cumulativeRH;
        cumulativeRH = parseFloat((cumulativeRH + dailyHours).toFixed(2));
        
        const crewIdx = Math.floor(Math.random() * CREW_USER_IDS.length);
        const crew = CREW_USER_IDS[crewIdx];
        
        let remark = null;
        if (isPort) {
          remark = PORT_REMARKS[Math.floor(Math.random() * PORT_REMARKS.length)];
        } else if (Math.random() < 0.02) {
          remark = WEATHER_REMARKS[Math.floor(Math.random() * WEATHER_REMARKS.length)];
        } else {
          remark = REMARKS[Math.floor(Math.random() * REMARKS.length)];
        }
        
        const enteredAt = new Date(current);
        enteredAt.setHours(12, Math.floor(Math.random() * 60), 0, 0);
        
        batch.push({
          vesselId: VESSEL_ID,
          componentId: comp.id,
          previousRH: prevRH.toFixed(2),
          newRH: cumulativeRH.toFixed(2),
          cumulativeRH: cumulativeRH.toFixed(2),
          dateUpdatedLocal: formatDate(current),
          dateUpdatedTZ: 'UTC',
          enteredAtUTC: enteredAt.toISOString(),
          userId: crew.id,
          source: 'bulk',
          notes: remark,
          meterReplaced: false,
          version: 1,
          isRenewalReset: false,
          componentCode: comp.code,
          componentName: comp.name,
        });
        
        if (batch.length >= BATCH_SIZE) {
          await insertBatch(pool, batch);
          totalInserted += batch.length;
          if (totalInserted % 5000 === 0) {
            console.log(`  Progress: ${totalInserted} entries inserted...`);
          }
          batch = [];
        }
        
        current.setDate(current.getDate() + 1);
        dayCount++;
      }
      
      await pool.query(
        'UPDATE components SET current_cumulative_rh = $1, last_updated = $2 WHERE id = $3',
        [cumulativeRH.toFixed(2), formatDate(new Date(END_DATE.getTime() - 86400000)), comp.id]
      );
      
      console.log(`  ${comp.name} (${comp.code}): ${dayCount} days, final RH: ${cumulativeRH.toFixed(2)}`);
    }
    
    if (batch.length > 0) {
      await insertBatch(pool, batch);
      totalInserted += batch.length;
    }
    
    console.log(`\n=== COMPLETE ===`);
    console.log(`Total running hours entries inserted: ${totalInserted}`);
    
    const verify = await pool.query(
      `SELECT component_id, COUNT(*) as entries, MIN(cumulative_rh::numeric) as min_rh, MAX(cumulative_rh::numeric) as max_rh 
       FROM running_hours_audit WHERE vessel_id = $1 
       GROUP BY component_id ORDER BY max_rh DESC`,
      [VESSEL_ID]
    );
    console.log('\nVerification:');
    for (const row of verify.rows) {
      console.log(`  ${row.component_id}: ${row.entries} entries, RH range: ${row.min_rh} - ${row.max_rh}`);
    }
    
  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

async function insertBatch(pool, batch) {
  const values = [];
  const placeholders = [];
  let paramIdx = 1;
  
  for (const row of batch) {
    placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
    values.push(
      row.vesselId, row.componentId, row.previousRH, row.newRH, row.cumulativeRH,
      row.dateUpdatedLocal, row.dateUpdatedTZ, row.enteredAtUTC, row.userId,
      row.source, row.notes, row.meterReplaced, row.version, row.isRenewalReset,
      row.componentCode, row.componentName
    );
  }
  
  const query = `INSERT INTO running_hours_audit 
    (vessel_id, component_id, previous_rh, new_rh, cumulative_rh, 
     date_updated_local, date_updated_tz, entered_at_utc, user_id,
     source, notes, meter_replaced, version, is_renewal_reset,
     component_code, component_name)
    VALUES ${placeholders.join(', ')}`;
  
  await pool.query(query, values);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
