const ws = require('ws');
const { Pool, neonConfig } = require('@neondatabase/serverless');
neonConfig.webSocketConstructor = ws;

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const START_DATE = new Date('2023-02-13');
const END_DATE = new Date('2026-02-13');

const CREW = {
  chief_eng: '228b5256-5bd2-4bf3-826f-c6fe76571449',
  second_eng: '056a433e-b880-43c6-9d59-b1cfe71a4014',
  third_eng: '6084f3b8-85dc-462a-b045-111d2b2e6d0e',
  fourth_eng: '480b40d0-04bd-4590-a936-2f879b867977',
};

const PORTS = ['Singapore', 'Fujairah', 'Jebel Ali', 'Colombo', 'Mumbai', 'Suez', 'Rotterdam', 'Piraeus', 'Durban', 'Houston'];
const engineers = [CREW.chief_eng, CREW.second_eng, CREW.third_eng, CREW.fourth_eng];

const CYLINDER_OIL_ID = 151;
const ME_SYSTEM_OIL_ID = 152;
const AE_LUBE_OIL_ID = 153;

const CHEMICAL_IDS = [161, 162, 163, 164, 165, 166, 167, 168, 169, 170];
const STORES_IDS = [141, 142, 143, 144, 145, 146, 147, 148, 149, 150];
const LUBE_IDS = [151, 152, 153, 154, 155, 156, 157, 158, 159, 160];

const ITEMS_MAP = {
  151: { code: 'LU-0001', name: 'Main Engine Cylinder Oil', uom: 'ltr', section: 'lubes' },
  152: { code: 'LU-0002', name: 'Main Engine System Oil', uom: 'ltr', section: 'lubes' },
  153: { code: 'LU-0003', name: 'Auxiliary Engine Lube Oil', uom: 'ltr', section: 'lubes' },
  154: { code: 'LU-0004', name: 'Turbocharger Lube Oil', uom: 'ltr', section: 'lubes' },
  155: { code: 'LU-0005', name: 'Hydraulic Oil', uom: 'ltr', section: 'lubes' },
  156: { code: 'LU-0006', name: 'Gear Oil', uom: 'ltr', section: 'lubes' },
  157: { code: 'LU-0007', name: 'Stern Tube Oil', uom: 'ltr', section: 'lubes' },
  158: { code: 'LU-0008', name: 'Compressor Oil', uom: 'ltr', section: 'lubes' },
  159: { code: 'LU-0009', name: 'Refrigeration Compressor Oil', uom: 'ltr', section: 'lubes' },
  160: { code: 'LU-0010', name: 'Multipurpose Grease', uom: 'ltr', section: 'lubes' },
  161: { code: 'CH-0001', name: 'Fuel Oil Treatment Chemical', uom: 'ltr', section: 'chemicals' },
  162: { code: 'CH-0002', name: 'Lube Oil Treatment Chemical', uom: 'ltr', section: 'chemicals' },
  163: { code: 'CH-0003', name: 'Boiler Water Treatment Chemical', uom: 'ltr', section: 'chemicals' },
  164: { code: 'CH-0004', name: 'Cooling Water Treatment Chemical', uom: 'ltr', section: 'chemicals' },
  165: { code: 'CH-0005', name: 'Potable Water Chlorination Chemical', uom: 'ltr', section: 'chemicals' },
  166: { code: 'CH-0006', name: 'Tank Cleaning Chemical (Alkaline)', uom: 'ltr', section: 'chemicals' },
  167: { code: 'CH-0007', name: 'Degreasing Chemical', uom: 'ltr', section: 'chemicals' },
  168: { code: 'CH-0008', name: 'Rust Remover / Descaling Chemical', uom: 'ltr', section: 'chemicals' },
  169: { code: 'CH-0009', name: 'Sewage Treatment Plant Chemical', uom: 'ltr', section: 'chemicals' },
  170: { code: 'CH-0010', name: 'Hand Cleaning Chemical (Industrial Soap)', uom: 'ltr', section: 'chemicals' },
  141: { code: 'IT-0001', name: 'Safety Gloves - Cotton', uom: 'pcs', section: 'stores' },
  142: { code: 'IT-0002', name: 'Jeevan', uom: 'pcs', section: 'stores' },
  143: { code: 'IT-0003', name: 'Grinding Wheel (Grinding Disc)', uom: 'pcs', section: 'stores' },
  144: { code: 'IT-0004', name: 'Cutting Disc (Angle Grinder)', uom: 'pcs', section: 'stores' },
  145: { code: 'IT-0005', name: 'Welding Electrodes (General Purpose)', uom: 'pcs', section: 'stores' },
  146: { code: 'IT-0006', name: 'Safety Goggles (Clear)', uom: 'pcs', section: 'stores' },
  147: { code: 'IT-0007', name: 'Ear Plugs (Disposable)', uom: 'pcs', section: 'stores' },
  148: { code: 'IT-0008', name: 'Dust Mask / Respirator Mask', uom: 'pcs', section: 'stores' },
  149: { code: 'IT-0009', name: 'Cotton Waste / Cleaning Rags', uom: 'pcs', section: 'stores' },
  150: { code: 'IT-0010', name: 'Emery Paper / Abrasive Sheet', uom: 'pcs', section: 'stores' },
};

function formatDateTimeLocal(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePortVisitDates() {
  const dates = [];
  let d = new Date(START_DATE);
  while (d < END_DATE) {
    const gap = 45 + Math.floor(Math.random() * 16);
    d = new Date(d.getTime() + gap * 24 * 60 * 60 * 1000);
    if (d < END_DATE) {
      dates.push(new Date(d));
    }
  }
  return dates;
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

async function insertBatch(pool, records) {
  if (records.length === 0) return;
  const values = [];
  const params = [];
  let idx = 1;
  for (const data of records) {
    values.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9},$${idx+10},$${idx+11},$${idx+12},$${idx+13},$${idx+14},$${idx+15},$${idx+16},$${idx+17})`);
    params.push(
      data.vesselId, data.section, data.itemId, data.partCode, data.itemName, data.uom,
      data.eventType, data.qtyChangeBase, data.qtyDisplay, data.uomDisplay, data.robAfterBase,
      data.dateLocal, data.tz, data.timestampUTC, data.userId, data.remarks,
      data.place || null, data.ref || null
    );
    idx += 18;
  }
  await pool.query(
    `INSERT INTO stores_ledger (
      vessel_id, section, item_id, part_code, item_name, uom,
      event_type, qty_change_base, qty_display, uom_display, rob_after_base,
      date_local, tz, timestamp_utc, user_id, remarks, place, ref
    ) VALUES ${values.join(',')}`,
    params
  );
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('=== Phase 2: Stores/Lubes Consumption Data for Vessel 3 ===\n');

    const portVisitDates = generatePortVisitDates();
    console.log(`Generated ${portVisitDates.length} port visit dates (every 45-60 days)`);
    portVisitDates.forEach((d, i) => console.log(`  Port visit ${i+1}: ${d.toISOString().split('T')[0]} - ${pickRandom(PORTS)}`));

    const robTracker = {};
    for (const id of [...LUBE_IDS, ...CHEMICAL_IDS]) {
      robTracker[id] = 5000;
    }
    for (const id of STORES_IDS) {
      robTracker[id] = 500;
    }

    const counters = {
      dailyCylinderOil: 0,
      monthlySystemOil: 0,
      chemicalConsumption: 0,
      portReceipts: 0,
    };

    console.log('\n--- 1. Daily Cylinder Oil Consumption (1,096 records) ---');
    let batch = [];
    let current = new Date(START_DATE);
    while (current < END_DATE) {
      const month = current.getMonth();
      const isWinter = (month >= 10 || month <= 2);
      const baseConsumption = isWinter ? 75 : 65;
      const variation = randBetween(-15, 55);
      const qty = parseFloat(Math.max(50, Math.min(120, baseConsumption + variation)).toFixed(1));

      robTracker[CYLINDER_OIL_ID] = Math.max(0, robTracker[CYLINDER_OIL_ID] - qty);
      const item = ITEMS_MAP[CYLINDER_OIL_ID];

      const hour = 6 + Math.floor(Math.random() * 4);
      const minute = Math.floor(Math.random() * 60);
      const ts = new Date(current);
      ts.setHours(hour, minute, 0, 0);

      batch.push({
        vesselId: VESSEL_ID, section: item.section, itemId: CYLINDER_OIL_ID,
        partCode: item.code, itemName: item.name, uom: item.uom,
        eventType: 'CONSUME', qtyChangeBase: (-qty).toFixed(2), qtyDisplay: (-qty).toFixed(2),
        uomDisplay: item.uom, robAfterBase: robTracker[CYLINDER_OIL_ID].toFixed(2),
        dateLocal: formatDateTimeLocal(ts), tz: 'UTC', timestampUTC: ts,
        userId: pickRandom(engineers),
        remarks: `Daily cylinder oil consumption - ${qty.toFixed(1)} ltr`,
      });
      counters.dailyCylinderOil++;

      if (batch.length >= 100) {
        await insertBatch(pool, batch);
        batch = [];
      }

      current.setDate(current.getDate() + 1);
    }
    if (batch.length > 0) {
      await insertBatch(pool, batch);
      batch = [];
    }
    console.log(`  Created ${counters.dailyCylinderOil} daily cylinder oil records`);

    console.log('\n--- 2. Monthly System Oil Top-ups (~36 records) ---');
    current = new Date(START_DATE);
    current.setDate(1);
    current.setMonth(current.getMonth() + 1);

    while (current < END_DATE) {
      const topUpDay = 10 + Math.floor(Math.random() * 10);
      const topUpDate = new Date(current.getFullYear(), current.getMonth(), topUpDay, 10 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));

      if (topUpDate < END_DATE) {
        const meQty = parseFloat(randBetween(100, 300).toFixed(1));
        robTracker[ME_SYSTEM_OIL_ID] = Math.max(0, robTracker[ME_SYSTEM_OIL_ID] - meQty);
        const meItem = ITEMS_MAP[ME_SYSTEM_OIL_ID];
        batch.push({
          vesselId: VESSEL_ID, section: meItem.section, itemId: ME_SYSTEM_OIL_ID,
          partCode: meItem.code, itemName: meItem.name, uom: meItem.uom,
          eventType: 'CONSUME', qtyChangeBase: (-meQty).toFixed(2), qtyDisplay: (-meQty).toFixed(2),
          uomDisplay: meItem.uom, robAfterBase: robTracker[ME_SYSTEM_OIL_ID].toFixed(2),
          dateLocal: formatDateTimeLocal(topUpDate), tz: 'UTC', timestampUTC: topUpDate,
          userId: CREW.chief_eng,
          remarks: `Monthly ME system oil top-up - ${meQty.toFixed(1)} ltr`,
        });
        counters.monthlySystemOil++;

        const aeQty = parseFloat(randBetween(100, 250).toFixed(1));
        robTracker[AE_LUBE_OIL_ID] = Math.max(0, robTracker[AE_LUBE_OIL_ID] - aeQty);
        const aeItem = ITEMS_MAP[AE_LUBE_OIL_ID];
        batch.push({
          vesselId: VESSEL_ID, section: aeItem.section, itemId: AE_LUBE_OIL_ID,
          partCode: aeItem.code, itemName: aeItem.name, uom: aeItem.uom,
          eventType: 'CONSUME', qtyChangeBase: (-aeQty).toFixed(2), qtyDisplay: (-aeQty).toFixed(2),
          uomDisplay: aeItem.uom, robAfterBase: robTracker[AE_LUBE_OIL_ID].toFixed(2),
          dateLocal: formatDateTimeLocal(topUpDate), tz: 'UTC', timestampUTC: topUpDate,
          userId: CREW.second_eng,
          remarks: `Monthly AE lube oil top-up - ${aeQty.toFixed(1)} ltr`,
        });
        counters.monthlySystemOil++;
      }

      current.setMonth(current.getMonth() + 1);
    }
    if (batch.length > 0) {
      await insertBatch(pool, batch);
      batch = [];
    }
    console.log(`  Created ${counters.monthlySystemOil} monthly system oil records`);

    console.log('\n--- 3. Chemical Consumption Aligned with Port Visits (~80 records) ---');
    for (const portDate of portVisitDates) {
      const numChemicals = 2 + Math.floor(Math.random() * 4);
      const selectedChemicals = [];
      const available = [...CHEMICAL_IDS];
      for (let i = 0; i < numChemicals && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        selectedChemicals.push(available.splice(idx, 1)[0]);
      }

      for (const chemId of selectedChemicals) {
        const daysAfterPort = Math.floor(Math.random() * 30) + 1;
        const consumeDate = new Date(portDate.getTime() + daysAfterPort * 24 * 60 * 60 * 1000);
        if (consumeDate >= END_DATE) continue;

        consumeDate.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
        const qty = parseFloat(randBetween(5, 40).toFixed(1));
        robTracker[chemId] = Math.max(0, robTracker[chemId] - qty);
        const item = ITEMS_MAP[chemId];

        batch.push({
          vesselId: VESSEL_ID, section: item.section, itemId: chemId,
          partCode: item.code, itemName: item.name, uom: item.uom,
          eventType: 'CONSUME', qtyChangeBase: (-qty).toFixed(2), qtyDisplay: (-qty).toFixed(2),
          uomDisplay: item.uom, robAfterBase: robTracker[chemId].toFixed(2),
          dateLocal: formatDateTimeLocal(consumeDate), tz: 'UTC', timestampUTC: consumeDate,
          userId: pickRandom(engineers),
          remarks: `Chemical consumption - ${item.name}`,
        });
        counters.chemicalConsumption++;
      }
    }
    if (batch.length > 0) {
      await insertBatch(pool, batch);
      batch = [];
    }
    console.log(`  Created ${counters.chemicalConsumption} chemical consumption records`);

    console.log('\n--- 4. Port-Visit Receipts (~40 records) ---');
    for (const portDate of portVisitDates) {
      const port = pickRandom(PORTS);
      const receiveDate = new Date(portDate);
      receiveDate.setHours(14 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));
      const poRef = `PO-${receiveDate.getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;

      const numReceipts = 1 + Math.floor(Math.random() * 3);
      const allReceivableIds = [...LUBE_IDS, ...CHEMICAL_IDS, ...STORES_IDS];
      const selectedIds = [];
      const avail = [...allReceivableIds];
      for (let i = 0; i < numReceipts && avail.length > 0; i++) {
        const idx = Math.floor(Math.random() * avail.length);
        selectedIds.push(avail.splice(idx, 1)[0]);
      }

      for (const itemId of selectedIds) {
        const item = ITEMS_MAP[itemId];
        const isStores = STORES_IDS.includes(itemId);
        const qty = isStores
          ? parseFloat(randBetween(20, 200).toFixed(0))
          : parseFloat(randBetween(200, 2000).toFixed(1));

        robTracker[itemId] = (robTracker[itemId] || 0) + qty;

        batch.push({
          vesselId: VESSEL_ID, section: item.section, itemId: itemId,
          partCode: item.code, itemName: item.name, uom: item.uom,
          eventType: 'RECEIVE', qtyChangeBase: qty.toFixed(2), qtyDisplay: qty.toFixed(2),
          uomDisplay: item.uom, robAfterBase: robTracker[itemId].toFixed(2),
          dateLocal: formatDateTimeLocal(receiveDate), tz: 'UTC', timestampUTC: receiveDate,
          userId: CREW.chief_eng,
          remarks: `Received at ${port}`,
          place: port,
          ref: poRef,
        });
        counters.portReceipts++;
      }
    }
    if (batch.length > 0) {
      await insertBatch(pool, batch);
      batch = [];
    }
    console.log(`  Created ${counters.portReceipts} port receipt records`);

    const totalCreated = counters.dailyCylinderOil + counters.monthlySystemOil + counters.chemicalConsumption + counters.portReceipts;

    console.log('\n========================================');
    console.log('  SUMMARY OF RECORDS CREATED');
    console.log('========================================');
    console.log(`  1. Daily Cylinder Oil:      ${counters.dailyCylinderOil}`);
    console.log(`  2. Monthly System Oil:      ${counters.monthlySystemOil}`);
    console.log(`  3. Chemical Consumption:    ${counters.chemicalConsumption}`);
    console.log(`  4. Port-Visit Receipts:     ${counters.portReceipts}`);
    console.log(`  ----------------------------------------`);
    console.log(`  TOTAL NEW RECORDS:          ${totalCreated}`);
    console.log('========================================\n');

    const verify = await pool.query(
      `SELECT section, event_type, COUNT(*) as cnt FROM stores_ledger WHERE vessel_id = $1 GROUP BY section, event_type ORDER BY section, event_type`,
      [VESSEL_ID]
    );
    console.log('Total stores_ledger breakdown (all records for vessel):');
    let grandTotal = 0;
    for (const row of verify.rows) {
      console.log(`  ${row.section.padEnd(12)} / ${row.event_type.padEnd(12)}: ${row.cnt}`);
      grandTotal += parseInt(row.cnt);
    }
    console.log(`  Grand total: ${grandTotal}`);

  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
