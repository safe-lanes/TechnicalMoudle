const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';
const BASE_DATE = new Date('2023-02-13');

const MONTHS_MAP = {
  'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
  'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
};

function parseDateDMY(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length < 3) return null;
  const day = parseInt(parts[0]);
  const month = MONTHS_MAP[parts[1]];
  const year = parseInt(parts[2]);
  if (isNaN(day) || month === undefined || isNaN(year)) return null;
  return new Date(year, month, day);
}

function daysBetween(d1, d2) {
  return Math.abs((d2 - d1) / (1000 * 60 * 60 * 24));
}

function getAvgHoursPerDay(componentCode) {
  if (componentCode.startsWith('601.')) return 18;
  if (componentCode.startsWith('651.') || componentCode.startsWith('652.') || componentCode.startsWith('653.')) return 12;
  if (componentCode.startsWith('411.')) return 21;
  if (componentCode.startsWith('554.')) return 20;
  if (componentCode.startsWith('702.') || componentCode.startsWith('712.')) return 12;
  if (componentCode.startsWith('665.')) return 0.4;
  return 14;
}

function getParentCode(componentCode) {
  const parts = componentCode.split('.');
  if (parts.length >= 2) return parts[0] + '.' + parts[1];
  return componentCode;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('=== Fix Vessel 3 Running Hours for 186 Completed WOs ===\n');

    const auditResult = await pool.query(`
      SELECT component_code, date_updated_local, cumulative_rh
      FROM running_hours_audit
      WHERE vessel_id = $1
      ORDER BY component_code, date_updated_local
    `, [VESSEL_ID]);

    const auditMap = {};
    for (const row of auditResult.rows) {
      if (!auditMap[row.component_code]) auditMap[row.component_code] = [];
      const dateStr = row.date_updated_local;
      const dateParts = dateStr.split(' ')[0];
      const parts = dateParts.split('-');
      const day = parseInt(parts[0]);
      const month = MONTHS_MAP[parts[1]];
      const year = parseInt(parts[2]);
      if (isNaN(day) || month === undefined || isNaN(year)) continue;
      auditMap[row.component_code].push({
        date: new Date(year, month, day),
        rh: parseFloat(row.cumulative_rh)
      });
    }

    for (const code of Object.keys(auditMap)) {
      auditMap[code].sort((a, b) => a.date - b.date);
    }

    console.log(`Loaded audit data for ${Object.keys(auditMap).length} components`);

    const woResult = await pool.query(`
      SELECT wo.id, wo.component_code, wo.date_completed, wo.interval_running_hour as wo_interval,
             j.interval_running_hour as job_interval
      FROM work_orders wo
      LEFT JOIN jobs j ON wo.job_id = j.id
      WHERE wo.vessel_id = $1
        AND wo.status = 'Completed'
        AND wo.maintenance_basis = 'Running Hours'
        AND wo.running_hours IS NULL
    `, [VESSEL_ID]);

    const workOrders = woResult.rows;
    console.log(`Found ${workOrders.length} WOs to fix\n`);

    function interpolateRH(componentCode, targetDate) {
      let entries = auditMap[componentCode];
      if (!entries || entries.length === 0) {
        const parent = getParentCode(componentCode);
        entries = auditMap[parent];
      }

      let lookupCode = componentCode;
      if (!entries || entries.length === 0) {
        const prefix = componentCode.split('.')[0];
        const candidates = Object.keys(auditMap).filter(k => k.startsWith(prefix + '.'));
        if (candidates.length > 0) {
          lookupCode = candidates[0];
          entries = auditMap[lookupCode];
        }
      }

      if (!entries || entries.length === 0) {
        return null;
      }

      if (targetDate <= entries[0].date) {
        const rate = entries.length > 1
          ? (entries[1].rh - entries[0].rh) / daysBetween(entries[0].date, entries[1].date)
          : getAvgHoursPerDay(componentCode);
        const daysBack = daysBetween(targetDate, entries[0].date);
        return Math.max(0, entries[0].rh - rate * daysBack);
      }

      if (targetDate >= entries[entries.length - 1].date) {
        const last = entries[entries.length - 1];
        const prev = entries.length > 1 ? entries[entries.length - 2] : null;
        const rate = prev
          ? (last.rh - prev.rh) / daysBetween(prev.date, last.date)
          : getAvgHoursPerDay(componentCode);
        const daysForward = daysBetween(last.date, targetDate);
        return last.rh + rate * daysForward;
      }

      for (let i = 0; i < entries.length - 1; i++) {
        if (targetDate >= entries[i].date && targetDate <= entries[i + 1].date) {
          const totalDays = daysBetween(entries[i].date, entries[i + 1].date);
          if (totalDays === 0) return entries[i].rh;
          const fraction = daysBetween(entries[i].date, targetDate) / totalDays;
          return entries[i].rh + fraction * (entries[i + 1].rh - entries[i].rh);
        }
      }

      return null;
    }

    let updatedCount = 0;
    let auditUsed = 0;
    let formulaUsed = 0;
    let errors = 0;

    for (const wo of workOrders) {
      const completionDate = parseDateDMY(wo.date_completed);
      if (!completionDate) {
        console.warn(`  Skipping WO ${wo.id}: invalid date_completed '${wo.date_completed}'`);
        errors++;
        continue;
      }

      let runningHours = interpolateRH(wo.component_code, completionDate);

      if (runningHours !== null) {
        auditUsed++;
      } else {
        const daysSinceStart = daysBetween(BASE_DATE, completionDate);
        const avgRate = getAvgHoursPerDay(wo.component_code);
        runningHours = daysSinceStart * avgRate;
        formulaUsed++;
      }

      runningHours = Math.round(runningHours * 100) / 100;

      const interval = parseInt(wo.wo_interval) || parseInt(wo.job_interval) || 4000;
      let previousReading = Math.max(0, runningHours - interval);
      previousReading = Math.round(previousReading * 100) / 100;
      const rhDifference = Math.round((runningHours - previousReading) * 100) / 100;

      try {
        await pool.query(`
          UPDATE work_orders
          SET running_hours = $1,
              previous_reading = $2,
              running_hours_difference = $3
          WHERE id = $4
        `, [
          String(runningHours),
          String(previousReading),
          String(rhDifference),
          wo.id
        ]);
        updatedCount++;
      } catch (err) {
        console.error(`  Error updating WO ${wo.id}: ${err.message}`);
        errors++;
      }
    }

    console.log(`\n=== RESULTS ===`);
    console.log(`Total WOs processed: ${workOrders.length}`);
    console.log(`Updated successfully: ${updatedCount}`);
    console.log(`  - Using audit data (interpolated): ${auditUsed}`);
    console.log(`  - Using formula calculation: ${formulaUsed}`);
    console.log(`Errors: ${errors}`);

    const verify = await pool.query(`
      SELECT COUNT(*) as remaining
      FROM work_orders
      WHERE vessel_id = $1
        AND status = 'Completed'
        AND maintenance_basis = 'Running Hours'
        AND running_hours IS NULL
    `, [VESSEL_ID]);
    console.log(`\nRemaining WOs with NULL running_hours: ${verify.rows[0].remaining}`);

    const sample = await pool.query(`
      SELECT component_code, date_completed, running_hours, previous_reading, running_hours_difference
      FROM work_orders
      WHERE vessel_id = $1
        AND status = 'Completed'
        AND maintenance_basis = 'Running Hours'
        AND running_hours IS NOT NULL
      ORDER BY component_code
      LIMIT 10
    `, [VESSEL_ID]);
    console.log('\nSample updated WOs:');
    for (const row of sample.rows) {
      console.log(`  ${row.component_code} | completed: ${row.date_completed} | RH: ${row.running_hours} | prev: ${row.previous_reading} | diff: ${row.running_hours_difference}`);
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
