const ws = require('ws');
const { Pool, neonConfig } = require('@neondatabase/serverless');
neonConfig.webSocketConstructor = ws;

const VESSEL_ID = '7440571a-841a-11ed-aa7c-7003bca91a86';

const POSTPONEMENT_REASONS = [
  { weight: 0.25, reasons: [
    "Spare parts awaiting delivery from supplier",
    "Pending receipt of replacement parts from maker"
  ]},
  { weight: 0.20, reasons: [
    "Awaiting next port call for shore-based maintenance support",
    "Deferred to scheduled drydock period"
  ]},
  { weight: 0.15, reasons: [
    "Operational priority - vessel at sea, cannot shut down equipment",
    "Component in continuous use, no standby available"
  ]},
  { weight: 0.15, reasons: [
    "Awaiting class surveyor attendance",
    "Survey coordination with classification society pending"
  ]},
  { weight: 0.10, reasons: [
    "Weather conditions not suitable for external work",
    "Sea state preventing safe access to equipment"
  ]},
  { weight: 0.10, reasons: [
    "Budget approval pending from technical superintendent",
    "Awaiting management authorization for major overhaul"
  ]},
  { weight: 0.05, reasons: [
    "Vendor specialist attendance required - scheduling in progress",
    "OEM technician availability pending"
  ]},
];

const AUTHORIZED_BY = ["Capt. Morrison", "C/E Petrov", "Supt. Nakamura"];

function pickReason() {
  const r = Math.random();
  let cumulative = 0;
  for (const bucket of POSTPONEMENT_REASONS) {
    cumulative += bucket.weight;
    if (r < cumulative) {
      return bucket.reasons[Math.floor(Math.random() * bucket.reasons.length)];
    }
  }
  return POSTPONEMENT_REASONS[0].reasons[0];
}

function pickAuthorizer() {
  return AUTHORIZED_BY[Math.floor(Math.random() * AUTHORIZED_BY.length)];
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('=== Phase 3b: Postponement Justification Population ===\n');

    // 1. Check work_order_postponements with empty reasons
    const postponementsEmpty = await pool.query(
      `SELECT id, work_order_id, postponement_reason, authorized_by, approval_remarks
       FROM work_order_postponements
       WHERE vessel_id = $1
         AND (postponement_reason IS NULL OR postponement_reason = ''
              OR authorized_by IS NULL OR authorized_by = '')`,
      [VESSEL_ID]
    );
    console.log(`work_order_postponements with empty reason/authorized_by: ${postponementsEmpty.rows.length}`);

    let postponementsUpdated = 0;
    for (const row of postponementsEmpty.rows) {
      const updates = {};
      if (!row.postponement_reason || row.postponement_reason === '') {
        updates.postponement_reason = pickReason();
      }
      if (!row.authorized_by || row.authorized_by === '') {
        updates.authorized_by = pickAuthorizer();
      }
      if (Object.keys(updates).length > 0) {
        const setClauses = [];
        const params = [];
        let idx = 1;
        for (const [key, val] of Object.entries(updates)) {
          setClauses.push(`${key} = $${idx}`);
          params.push(val);
          idx++;
        }
        params.push(row.id);
        await pool.query(
          `UPDATE work_order_postponements SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
          params
        );
        postponementsUpdated++;
      }
    }
    console.log(`work_order_postponements updated: ${postponementsUpdated}`);

    // 2. Check work_orders with postponement-suggesting status but null postponement fields
    const woNeedingReasons = await pool.query(
      `SELECT id, status, postponement_reason, postponement_authorized_by, postponement_end_date, due_date
       FROM work_orders
       WHERE vessel_id = $1
         AND (postponement_reason IS NULL OR postponement_reason = ''
              OR postponement_authorized_by IS NULL OR postponement_authorized_by = '')
         AND status IN ('Overdue', 'Due (Grace P)')`,
      [VESSEL_ID]
    );
    console.log(`\nwork_orders (Overdue/Due Grace) needing postponement data: ${woNeedingReasons.rows.length}`);

    let woUpdated = 0;
    const reasonDistribution = {};
    const authDistribution = {};

    for (const row of woNeedingReasons.rows) {
      const reason = pickReason();
      const authorizer = pickAuthorizer();

      const updates = [];
      const params = [];
      let idx = 1;

      if (!row.postponement_reason || row.postponement_reason === '') {
        updates.push(`postponement_reason = $${idx}`);
        params.push(reason);
        idx++;
        reasonDistribution[reason] = (reasonDistribution[reason] || 0) + 1;
      }
      if (!row.postponement_authorized_by || row.postponement_authorized_by === '') {
        updates.push(`postponement_authorized_by = $${idx}`);
        params.push(authorizer);
        idx++;
        authDistribution[authorizer] = (authDistribution[authorizer] || 0) + 1;
      }
      if (!row.postponement_end_date) {
        const dueDate = row.due_date ? new Date(row.due_date.replace(/(\d{2})-(\w{3})-(\d{4})/, '$2 $1, $3')) : new Date();
        const endDate = new Date(dueDate);
        endDate.setDate(endDate.getDate() + 14 + Math.floor(Math.random() * 46));
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const endDateStr = `${String(endDate.getDate()).padStart(2,'0')}-${months[endDate.getMonth()]}-${endDate.getFullYear()}`;
        updates.push(`postponement_end_date = $${idx}`);
        params.push(endDateStr);
        idx++;
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        params.push(row.id);
        await pool.query(
          `UPDATE work_orders SET ${updates.join(', ')} WHERE id = $${idx}`,
          params
        );
        woUpdated++;
      }
    }

    console.log(`work_orders updated: ${woUpdated}`);

    // 3. Print summary
    console.log('\n=== SUMMARY ===');
    console.log(`\nwork_order_postponements table updates: ${postponementsUpdated}`);
    console.log(`work_orders table updates: ${woUpdated}`);

    console.log('\n--- Reason Distribution (work_orders) ---');
    const sortedReasons = Object.entries(reasonDistribution).sort((a, b) => b[1] - a[1]);
    for (const [reason, count] of sortedReasons) {
      console.log(`  ${count} - ${reason}`);
    }

    console.log('\n--- Authorizer Distribution (work_orders) ---');
    for (const [auth, count] of Object.entries(authDistribution).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count} - ${auth}`);
    }

    // 4. Verification
    console.log('\n--- Verification ---');
    const verifyPostponements = await pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN postponement_reason IS NULL OR postponement_reason = '' THEN 1 END) as empty_reason,
         COUNT(CASE WHEN authorized_by IS NULL OR authorized_by = '' THEN 1 END) as empty_auth
       FROM work_order_postponements WHERE vessel_id = $1`,
      [VESSEL_ID]
    );
    const vp = verifyPostponements.rows[0];
    console.log(`work_order_postponements: ${vp.total} total, ${vp.empty_reason} empty reasons, ${vp.empty_auth} empty auth`);

    const verifyWOs = await pool.query(
      `SELECT
         status,
         COUNT(*) as total,
         COUNT(CASE WHEN postponement_reason IS NULL OR postponement_reason = '' THEN 1 END) as empty_reason,
         COUNT(CASE WHEN postponement_authorized_by IS NULL OR postponement_authorized_by = '' THEN 1 END) as empty_auth
       FROM work_orders WHERE vessel_id = $1 AND status IN ('Overdue', 'Due (Grace P)')
       GROUP BY status`,
      [VESSEL_ID]
    );
    console.log('\nwork_orders postponement fields:');
    for (const row of verifyWOs.rows) {
      console.log(`  ${row.status}: ${row.total} total, ${row.empty_reason} empty reasons, ${row.empty_auth} empty auth`);
    }

    console.log('\n=== Phase 3b COMPLETE ===');

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
