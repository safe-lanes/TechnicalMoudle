const { Pool } = require('pg');

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const START_DATE = new Date('2023-02-13');
const END_DATE = new Date('2026-02-13');

const CREW = {
  chief_eng: '228b5256-5bd2-4bf3-826f-c6fe76571449',
  second_eng: '056a433e-b880-43c6-9d59-b1cfe71a4014',
  third_eng: '6084f3b8-85dc-462a-b045-111d2b2e6d0e',
  fourth_eng: '480b40d0-04bd-4590-a936-2f879b867977',
  electrician: '977621de-77d7-4892-ae27-adaebcc27d0b',
};

const ENGINEERS = [CREW.chief_eng, CREW.second_eng, CREW.third_eng, CREW.fourth_eng, CREW.electrician];

const PORTS = ['Singapore', 'Fujairah', 'Jebel Ali', 'Colombo', 'Mumbai', 'Suez', 'Rotterdam', 'Houston', 'Shanghai', 'Busan'];
const SUPPLIERS = ['MarineSpares Int.', 'Global Ship Supply', 'Pacific Marine Parts', 'Nordic Maritime Supply', 'Atlas Marine Parts', 'Ocean Trading Co.'];

function formatDateDMY(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function formatDateTimeLocal(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('=== Phase 5: Spare Parts Transactions ===');
    
    const sparesResult = await pool.query(
      `SELECT id, part_code, part_name, component_id, component_code, component_name, 
              component_spare_code, rob, rob_location_a, rob_location_b, min, max, unit_cost, vessel_id
       FROM spares WHERE vessel_id = $1 AND deleted = false LIMIT 500`,
      [VESSEL_ID]
    );
    const spares = sparesResult.rows;
    console.log(`Found ${spares.length} spare parts`);
    
    const completedWOs = await pool.query(
      `SELECT id, work_order_no, component, component_code, date_completed, assigned_to
       FROM work_orders WHERE vessel_id = $1 AND status = 'Completed' AND id LIKE 'WO-%'
       ORDER BY date_completed`,
      [VESSEL_ID]
    );
    console.log(`Found ${completedWOs.rows.length} completed work orders`);
    
    const sparesByComponent = {};
    for (const spare of spares) {
      const key = spare.component_code || spare.component_id || 'general';
      if (!sparesByComponent[key]) sparesByComponent[key] = [];
      sparesByComponent[key].push(spare);
    }
    
    let receiptCount = 0;
    let consumeCount = 0;
    const robTracker = {};
    
    for (const spare of spares) {
      robTracker[spare.id] = {
        total: parseInt(spare.rob) || 0,
        locA: parseInt(spare.rob_location_a) || 0,
        locB: parseInt(spare.rob_location_b) || 0,
      };
    }
    
    console.log('\n--- Generating Consumption Records ---');
    const woForConsumption = completedWOs.rows.filter(() => Math.random() < 0.5);
    
    for (const wo of woForConsumption) {
      const matchingSpares = sparesByComponent[wo.component_code] || [];
      let usedSpares = matchingSpares.length > 0 ? matchingSpares : [spares[Math.floor(Math.random() * spares.length)]];
      
      const numSpares = 1 + Math.floor(Math.random() * 3);
      usedSpares = usedSpares.slice(0, numSpares);
      
      for (const spare of usedSpares) {
        const qtyConsumed = 1 + Math.floor(Math.random() * 2);
        const tracker = robTracker[spare.id];
        if (!tracker) continue;
        
        const robBefore = tracker.total;
        tracker.total = Math.max(0, tracker.total - qtyConsumed);
        tracker.locA = Math.max(0, tracker.locA - qtyConsumed);
        
        const eventDate = wo.date_completed ? new Date(wo.date_completed) : new Date(START_DATE.getTime() + Math.random() * (END_DATE - START_DATE));
        
        try {
          await pool.query(
            `INSERT INTO spares_history (
              timestamp_utc, vessel_id, spare_id, part_code, part_name,
              component_id, component_code, component_name, component_spare_code,
              event_type, qty_change, rob_after, user_id, remarks, reference, date_local, tz
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [
              eventDate, VESSEL_ID, spare.id, spare.part_code, spare.part_name,
              spare.component_id || wo.component_code, spare.component_code || wo.component_code,
              spare.component_name || wo.component, spare.component_spare_code,
              'CONSUME', -qtyConsumed, tracker.total,
              ENGINEERS[Math.floor(Math.random() * ENGINEERS.length)],
              `Consumed for WO ${wo.work_order_no}`,
              wo.work_order_no, formatDateTimeLocal(eventDate), 'UTC'
            ]
          );
          consumeCount++;
        } catch (err) {
          console.error(`Consume error: ${err.message}`);
        }
      }
    }
    console.log(`  Consumption records: ${consumeCount}`);
    
    console.log('\n--- Generating Receipt Records ---');
    const monthlyDates = [];
    let d = new Date(START_DATE);
    while (d < END_DATE) {
      monthlyDates.push(new Date(d));
      d.setMonth(d.getMonth() + 1);
    }
    
    for (const receiptDate of monthlyDates) {
      const sparesForReceipt = spares.filter(() => Math.random() < 0.08);
      const port = PORTS[Math.floor(Math.random() * PORTS.length)];
      const supplier = SUPPLIERS[Math.floor(Math.random() * SUPPLIERS.length)];
      
      for (const spare of sparesForReceipt) {
        const qtyReceived = 1 + Math.floor(Math.random() * 5);
        const tracker = robTracker[spare.id];
        if (!tracker) continue;
        
        tracker.total += qtyReceived;
        tracker.locA += qtyReceived;
        
        try {
          await pool.query(
            `INSERT INTO spares_history (
              timestamp_utc, vessel_id, spare_id, part_code, part_name,
              component_id, component_code, component_name, component_spare_code,
              event_type, qty_change, rob_after, user_id, remarks, reference, date_local, tz, place
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [
              receiptDate, VESSEL_ID, spare.id, spare.part_code, spare.part_name,
              spare.component_id, spare.component_code, spare.component_name, spare.component_spare_code,
              'RECEIVE', qtyReceived, tracker.total,
              CREW.chief_eng,
              `Received from ${supplier} at ${port}`,
              `PO-${receiptDate.getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4,'0')}`,
              formatDateTimeLocal(receiptDate), 'UTC', port
            ]
          );
          receiptCount++;
        } catch (err) {
          console.error(`Receipt error: ${err.message}`);
        }
      }
    }
    console.log(`  Receipt records: ${receiptCount}`);
    
    console.log('\n--- Updating Current ROB Levels ---');
    let robUpdated = 0;
    for (const spare of spares) {
      const tracker = robTracker[spare.id];
      if (!tracker) continue;
      
      await pool.query(
        `UPDATE spares SET rob = $1, rob_location_a = $2, rob_location_b = $3, updated_at = NOW() WHERE id = $1`,
        [tracker.total, tracker.locA, tracker.locB]
      );
      robUpdated++;
    }
    
    console.log(`\n=== COMPLETE ===`);
    console.log(`Consumption records: ${consumeCount}`);
    console.log(`Receipt records: ${receiptCount}`);
    console.log(`Total spare history records: ${consumeCount + receiptCount}`);
    
    const verify = await pool.query(
      `SELECT event_type, COUNT(*) as cnt FROM spares_history WHERE vessel_id = $1 GROUP BY event_type`,
      [VESSEL_ID]
    );
    console.log('\nVerification:');
    for (const row of verify.rows) {
      console.log(`  ${row.event_type}: ${row.cnt}`);
    }
    
  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
