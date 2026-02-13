const { Pool } = require('pg');

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const START_DATE = new Date('2023-02-13');
const END_DATE = new Date('2026-02-13');

const CREW = {
  chief_eng: '228b5256-5bd2-4bf3-826f-c6fe76571449',
  second_eng: '056a433e-b880-43c6-9d59-b1cfe71a4014',
  third_eng: '6084f3b8-85dc-462a-b045-111d2b2e6d0e',
  fourth_eng: '480b40d0-04bd-4590-a936-2f879b867977',
};

const PORTS = ['Singapore', 'Fujairah', 'Jebel Ali', 'Colombo', 'Mumbai', 'Suez', 'Rotterdam'];

function formatDateTimeLocal(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('=== Phase 6: Stores/Lubes/Chemicals Transactions ===');
    
    const itemsResult = await pool.query(
      `SELECT id, vessel_id, item_type, item_code, item_name, category, uom, rob, rob_location_a, rob_location_b, min, max
       FROM stores_items WHERE vessel_id = $1`,
      [VESSEL_ID]
    );
    const items = itemsResult.rows;
    console.log(`Found ${items.length} stores items`);
    
    if (items.length === 0) {
      console.log('No stores items found. Skipping.');
      await pool.end();
      return;
    }
    
    const robTracker = {};
    for (const item of items) {
      robTracker[item.id] = parseFloat(item.rob) || 10;
    }
    
    let totalRecords = 0;
    const totalDays = Math.ceil((END_DATE - START_DATE) / (1000 * 60 * 60 * 24));
    const engineers = [CREW.chief_eng, CREW.second_eng, CREW.third_eng, CREW.fourth_eng];
    
    let portVisitDates = [];
    let d = new Date(START_DATE);
    while (d < END_DATE) {
      d.setDate(d.getDate() + 30 + Math.floor(Math.random() * 15));
      if (d < END_DATE) portVisitDates.push(new Date(d));
    }
    console.log(`Port visits: ${portVisitDates.length}`);
    
    const lubeItems = items.filter(i => i.item_type === 'lubricants');
    const chemItems = items.filter(i => i.item_type === 'chemicals');
    const storesItems = items.filter(i => i.item_type === 'stores' || i.item_type === 'others');
    
    console.log(`  Lubricants: ${lubeItems.length}, Chemicals: ${chemItems.length}, Stores: ${storesItems.length}`);
    
    console.log('\n--- Generating Daily/Weekly/Monthly Consumption ---');
    
    let current = new Date(START_DATE);
    while (current < END_DATE) {
      const dayOfMonth = current.getDate();
      const dayOfWeek = current.getDay();
      
      for (const item of lubeItems) {
        if (Math.random() < 0.3) {
          const qty = parseFloat((0.5 + Math.random() * 5).toFixed(2));
          robTracker[item.id] = Math.max(0, (robTracker[item.id] || 0) - qty);
          
          await insertLedger(pool, {
            vesselId: VESSEL_ID, section: 'lubes', itemId: item.id,
            partCode: item.item_code, itemName: item.item_name, uom: item.uom || 'Litres',
            eventType: 'CONSUME', qtyChangeBase: (-qty).toFixed(2), qtyDisplay: (-qty).toFixed(2),
            uomDisplay: item.uom || 'Litres', robAfterBase: robTracker[item.id].toFixed(2),
            dateLocal: formatDateTimeLocal(current), tz: 'UTC', timestampUTC: current,
            userId: engineers[Math.floor(Math.random() * engineers.length)],
            remarks: 'Daily lube oil consumption',
          });
          totalRecords++;
        }
      }
      
      if (dayOfWeek === 1) {
        for (const item of chemItems) {
          if (Math.random() < 0.4) {
            const qty = parseFloat((0.1 + Math.random() * 2).toFixed(2));
            robTracker[item.id] = Math.max(0, (robTracker[item.id] || 0) - qty);
            
            await insertLedger(pool, {
              vesselId: VESSEL_ID, section: 'chemicals', itemId: item.id,
              partCode: item.item_code, itemName: item.item_name, uom: item.uom || 'Litres',
              eventType: 'CONSUME', qtyChangeBase: (-qty).toFixed(2), qtyDisplay: (-qty).toFixed(2),
              uomDisplay: item.uom || 'Litres', robAfterBase: robTracker[item.id].toFixed(2),
              dateLocal: formatDateTimeLocal(current), tz: 'UTC', timestampUTC: current,
              userId: engineers[Math.floor(Math.random() * engineers.length)],
              remarks: 'Weekly chemical consumption',
            });
            totalRecords++;
          }
        }
      }
      
      if (dayOfMonth === 1 || dayOfMonth === 15) {
        for (const item of storesItems) {
          if (Math.random() < 0.25) {
            const qty = parseFloat((1 + Math.random() * 3).toFixed(2));
            robTracker[item.id] = Math.max(0, (robTracker[item.id] || 0) - qty);
            
            await insertLedger(pool, {
              vesselId: VESSEL_ID, section: 'stores', itemId: item.id,
              partCode: item.item_code, itemName: item.item_name, uom: item.uom || 'Pcs',
              eventType: 'CONSUME', qtyChangeBase: (-qty).toFixed(2), qtyDisplay: (-qty).toFixed(2),
              uomDisplay: item.uom || 'Pcs', robAfterBase: robTracker[item.id].toFixed(2),
              dateLocal: formatDateTimeLocal(current), tz: 'UTC', timestampUTC: current,
              userId: engineers[Math.floor(Math.random() * engineers.length)],
              remarks: 'General stores consumption',
            });
            totalRecords++;
          }
        }
      }
      
      if (totalRecords % 1000 === 0 && totalRecords > 0) {
        console.log(`  Progress: ${totalRecords} records...`);
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    console.log(`  Consumption records: ${totalRecords}`);
    
    console.log('\n--- Generating Receipt Records at Port Visits ---');
    let receiptRecords = 0;
    
    for (const portDate of portVisitDates) {
      const port = PORTS[Math.floor(Math.random() * PORTS.length)];
      
      for (const item of items) {
        if (Math.random() < 0.3) {
          const qty = parseFloat((5 + Math.random() * 50).toFixed(2));
          robTracker[item.id] = (robTracker[item.id] || 0) + qty;
          
          const section = item.item_type === 'lubricants' ? 'lubes' : item.item_type === 'chemicals' ? 'chemicals' : 'stores';
          
          await insertLedger(pool, {
            vesselId: VESSEL_ID, section, itemId: item.id,
            partCode: item.item_code, itemName: item.item_name, uom: item.uom || 'Litres',
            eventType: 'RECEIVE', qtyChangeBase: qty.toFixed(2), qtyDisplay: qty.toFixed(2),
            uomDisplay: item.uom || 'Litres', robAfterBase: robTracker[item.id].toFixed(2),
            dateLocal: formatDateTimeLocal(portDate), tz: 'UTC', timestampUTC: portDate,
            userId: CREW.chief_eng, remarks: `Received at ${port}`, place: port,
            ref: `PO-${portDate.getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4,'0')}`,
          });
          receiptRecords++;
        }
      }
    }
    
    console.log(`  Receipt records: ${receiptRecords}`);
    totalRecords += receiptRecords;
    
    console.log('\n--- Updating Current ROB Levels ---');
    for (const item of items) {
      const rob = robTracker[item.id] || 0;
      await pool.query(
        `UPDATE stores_items SET rob = $1, rob_location_a = $2, updated_at = NOW() WHERE id = $3`,
        [rob.toFixed(2), rob.toFixed(2), item.id]
      );
    }
    
    console.log(`\n=== COMPLETE ===`);
    console.log(`Total stores ledger records: ${totalRecords}`);
    
    const verify = await pool.query(
      `SELECT section, event_type, COUNT(*) as cnt FROM stores_ledger WHERE vessel_id = $1 GROUP BY section, event_type ORDER BY section, event_type`,
      [VESSEL_ID]
    );
    console.log('\nVerification:');
    for (const row of verify.rows) {
      console.log(`  ${row.section} / ${row.event_type}: ${row.cnt}`);
    }
    
  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

async function insertLedger(pool, data) {
  await pool.query(
    `INSERT INTO stores_ledger (
      vessel_id, section, item_id, part_code, item_name, uom,
      event_type, qty_change_base, qty_display, uom_display, rob_after_base,
      date_local, tz, timestamp_utc, user_id, remarks, place, ref
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      data.vesselId, data.section, data.itemId, data.partCode, data.itemName, data.uom,
      data.eventType, data.qtyChangeBase, data.qtyDisplay, data.uomDisplay, data.robAfterBase,
      data.dateLocal, data.tz, data.timestampUTC, data.userId, data.remarks,
      data.place || null, data.ref || null
    ]
  );
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
