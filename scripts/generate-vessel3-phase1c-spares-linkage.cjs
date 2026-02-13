const ws = require('ws');
const { Pool, neonConfig } = require('@neondatabase/serverless');
neonConfig.webSocketConstructor = ws;

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';

function formatDateDMY(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('=== Phase 1c: Spare Parts Consumption Linkage for Vessel 3 ===\n');

    const allCompletedRes = await pool.query(
      `SELECT id, work_order_no, component, component_code, date_completed, assigned_to
       FROM work_orders WHERE vessel_id = $1 AND status = 'Completed'
       ORDER BY date_completed`,
      [VESSEL_ID]
    );
    console.log(`Total completed WOs: ${allCompletedRes.rows.length}`);

    const existingRefsRes = await pool.query(
      `SELECT DISTINCT reference FROM spares_history
       WHERE vessel_id = $1 AND event_type = 'CONSUME' AND reference LIKE 'WO-%'`,
      [VESSEL_ID]
    );
    const existingRefs = new Set(existingRefsRes.rows.map(r => r.reference));
    console.log(`WOs already linked via spares_history: ${existingRefs.size}`);

    const sparesRes = await pool.query(
      `SELECT id, part_code, part_name, component_id, component_code, component_name,
              component_spare_code, rob
       FROM spares WHERE vessel_id = $1 AND deleted = false`,
      [VESSEL_ID]
    );
    const spares = sparesRes.rows;
    console.log(`Total spare parts: ${spares.length}`);

    const sparesByComponent = {};
    for (const spare of spares) {
      if (spare.component_code) {
        if (!sparesByComponent[spare.component_code]) sparesByComponent[spare.component_code] = [];
        sparesByComponent[spare.component_code].push(spare);
      }
    }

    const totalCompleted = allCompletedRes.rows.length;
    const targetPct = 0.60 + Math.random() * 0.10;
    const targetLinked = Math.round(totalCompleted * targetPct);
    const needed = targetLinked - existingRefs.size;

    console.log(`\nTarget: ${(targetPct * 100).toFixed(1)}% = ${targetLinked} WOs linked`);
    console.log(`Already linked: ${existingRefs.size}`);
    console.log(`Need to process: ${needed} more WOs\n`);

    if (needed <= 0) {
      console.log('Already at target. Nothing to do.');
      await pool.end();
      return;
    }

    const unlinkedWOs = allCompletedRes.rows.filter(wo => !existingRefs.has(wo.work_order_no));
    console.log(`Unlinked WOs available: ${unlinkedWOs.length}`);

    const shuffled = unlinkedWOs.sort(() => Math.random() - 0.5);
    const toProcess = shuffled.slice(0, needed);
    console.log(`Will process: ${toProcess.length} WOs\n`);

    const robTracker = {};
    for (const spare of spares) {
      robTracker[spare.id] = parseInt(spare.rob) || 0;
    }

    let consumeHistoryCount = 0;
    let woUpdatedCount = 0;
    let componentMatchCount = 0;
    let randomMatchCount = 0;

    for (const wo of toProcess) {
      let matchedSpares = [];
      
      if (wo.component_code && sparesByComponent[wo.component_code]) {
        matchedSpares = [...sparesByComponent[wo.component_code]];
        componentMatchCount++;
      }
      
      if (matchedSpares.length === 0) {
        const randomCount = 1 + Math.floor(Math.random() * 3);
        const indices = new Set();
        while (indices.size < Math.min(randomCount, spares.length)) {
          indices.add(Math.floor(Math.random() * spares.length));
        }
        matchedSpares = [...indices].map(i => spares[i]);
        randomMatchCount++;
      }

      const numSpares = 1 + Math.floor(Math.random() * 3);
      const selectedSpares = matchedSpares.sort(() => Math.random() - 0.5).slice(0, numSpares);

      const consumedParts = [];
      const eventDate = wo.date_completed ? new Date(wo.date_completed) : new Date();
      const dateLocal = formatDateDMY(eventDate);

      for (const spare of selectedSpares) {
        const qty = 1 + Math.floor(Math.random() * 2);
        const currentRob = robTracker[spare.id] || 0;
        const robAfter = Math.max(0, currentRob - qty);
        robTracker[spare.id] = robAfter;

        consumedParts.push({
          spareId: spare.id,
          partCode: spare.part_code,
          partName: spare.part_name,
          quantity: qty
        });

        try {
          await pool.query(
            `INSERT INTO spares_history (
              timestamp_utc, vessel_id, spare_id, part_code, part_name,
              component_id, component_code, component_name, component_spare_code,
              event_type, qty_change, rob_after, user_id, remarks, reference, date_local, tz, place
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [
              eventDate, VESSEL_ID, spare.id, spare.part_code, spare.part_name,
              spare.component_id || null, spare.component_code || wo.component_code,
              spare.component_name || wo.component, spare.component_spare_code || null,
              'CONSUME', -qty, robAfter,
              wo.assigned_to || null,
              `Consumed during maintenance - ${wo.work_order_no}`,
              wo.work_order_no, dateLocal, 'UTC', null
            ]
          );
          consumeHistoryCount++;
        } catch (err) {
          console.error(`  History insert error for ${wo.work_order_no}: ${err.message}`);
        }
      }

      try {
        await pool.query(
          `UPDATE work_orders SET consumed_spare_parts = $1 WHERE id = $2`,
          [JSON.stringify(consumedParts), wo.id]
        );
        woUpdatedCount++;
      } catch (err) {
        console.error(`  WO update error for ${wo.work_order_no}: ${err.message}`);
      }

      if (woUpdatedCount % 100 === 0 && woUpdatedCount > 0) {
        console.log(`  Progress: ${woUpdatedCount}/${toProcess.length} WOs processed...`);
      }
    }

    const alsoUpdateExisting = [];
    for (const wo of allCompletedRes.rows) {
      if (existingRefs.has(wo.work_order_no)) {
        alsoUpdateExisting.push(wo);
      }
    }

    let existingUpdated = 0;
    for (const wo of alsoUpdateExisting) {
      const historyRes = await pool.query(
        `SELECT spare_id, part_code, part_name, ABS(qty_change) as quantity
         FROM spares_history
         WHERE vessel_id = $1 AND reference = $2 AND event_type = 'CONSUME'`,
        [VESSEL_ID, wo.work_order_no]
      );

      if (historyRes.rows.length > 0) {
        const parts = historyRes.rows.map(r => ({
          spareId: r.spare_id,
          partCode: r.part_code,
          partName: r.part_name,
          quantity: parseInt(r.quantity)
        }));

        await pool.query(
          `UPDATE work_orders SET consumed_spare_parts = $1 WHERE id = $2`,
          [JSON.stringify(parts), wo.id]
        );
        existingUpdated++;
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`New WOs processed: ${woUpdatedCount}`);
    console.log(`  - Component code matches: ${componentMatchCount}`);
    console.log(`  - Random spare matches: ${randomMatchCount}`);
    console.log(`New spares_history CONSUME records: ${consumeHistoryCount}`);
    console.log(`Existing WOs updated with consumed_spare_parts JSON: ${existingUpdated}`);
    console.log(`Total WOs now linked: ${existingRefs.size + woUpdatedCount}`);
    console.log(`Percentage: ${(((existingRefs.size + woUpdatedCount) / totalCompleted) * 100).toFixed(1)}%`);

    const verifyRes = await pool.query(
      `SELECT COUNT(DISTINCT reference) as linked FROM spares_history
       WHERE vessel_id = $1 AND event_type = 'CONSUME' AND reference LIKE 'WO-%'`,
      [VESSEL_ID]
    );
    console.log(`\nVerification - Distinct WO references in spares_history: ${verifyRes.rows[0].linked}`);

    const woWithParts = await pool.query(
      `SELECT COUNT(*) as cnt FROM work_orders
       WHERE vessel_id = $1 AND status = 'Completed'
       AND consumed_spare_parts IS NOT NULL AND consumed_spare_parts::text != '[]' AND consumed_spare_parts::text != 'null'`,
      [VESSEL_ID]
    );
    console.log(`WOs with consumed_spare_parts populated: ${woWithParts.rows[0].cnt}`);
    console.log(`Final percentage: ${((parseInt(woWithParts.rows[0].cnt) / totalCompleted) * 100).toFixed(1)}%`);

  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
