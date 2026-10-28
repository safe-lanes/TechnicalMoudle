/**
 * Read-only characterization against development data. No fixture inserts,
 * approvals, stock operations, or schema changes. Raw records stay in process;
 * the report contains counts only.
 *
 * node --import tsx tests/db/work-orders-pagination-parity.ts
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { initStorage, storage } from '../../server/storage';
import { getPool } from '../../server/db';
import { tenantStorage } from '../../server/utils/asyncLocalStorage';
import { listWorkOrders } from '../../server/modules/work-orders/services/workOrderService';
import { workOrderProjection } from '../../server/modules/work-orders/repositories/workOrderPagingProjection';
import { hydrateWorkOrderPageRow, workOrderFilterPredicate, workOrderOrdering } from '../../server/modules/work-orders/repositories/workOrderPagingRepository';
import { workOrderPageQuery, WORK_ORDER_SORT_FIELDS } from '../../shared/workOrdersPagination';
import { WORK_ORDER_TABS, compareWorkOrders, filterAndSortWorkOrders } from '../../shared/utils/workOrderFilters';
import { parseWorkOrderDate } from '../../shared/workOrders/dateParse';

await initStorage();
const pool = await getPool();
const client = await pool.connect();
let failures = 0;
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await tenantStorage.run({ tuid: 'work-order-read-only-parity', db: drizzle(client), pool }, async () => {
    const reference = new Date();
    const legacy = await listWorkOrders('all');
    const config = await storage.getCompanyStandardGraceSettings();
    const projection = workOrderProjection({ vesselIds: null }, reference, config, 'all');
    const db = drizzle(client);
    const projected = await db.execute(sql`${projection} SELECT * FROM projection`);
    const byId = new Map(projected.rows.map(row => [row.wouuid, row]));
    const legacyById = new Map(legacy.map(row => [row.wouuid, row]));
    const priorities: Record<string, number> = {
      Overdue: 1, 'Due (Grace P)': 2, Due: 3, 'Due Soon': 4, Planned: 5,
      Postponed: 6, 'Pending Approval': 7, Active: 8, Completed: 9, Rejected: 10,
    };
    // User-approved deterministic default order replaces the old cyclic
    // missing-date comparison. All other fields remain differential checks.
    const compareDefault = (a: any, b: any) => {
      const priority = (priorities[a.computedStatus] ?? 99) - (priorities[b.computedStatus] ?? 99);
      return priority
        || Number(Boolean(a.dueDate)) - Number(Boolean(b.dueDate))
        || (parseWorkOrderDate(a.dueDate)?.getTime() ?? 0) - (parseWorkOrderDate(b.dueDate)?.getTime() ?? 0)
        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        || (a.wouuid < b.wouuid ? -1 : a.wouuid > b.wouuid ? 1 : 0);
    };
    legacy.sort(compareDefault);
    const fields = [
      'maintenanceBasis', 'assignedTo', 'criticality', 'computedStatus', 'missedCycles',
      'leadTimeValue', 'leadTimeUnit', 'componentCritical', 'dueRH', 'nextDueHour',
      'rhEstimatedDueDate', 'currentRH', 'rhLeadTimeHours', 'plannedDate',
    ];
    const hydrationDifferences: Record<string, number> = {};
    for (const row of legacy) {
      const match = byId.get(row.wouuid);
      if (!match) { failures++; continue; }
      const hydrated = hydrateWorkOrderPageRow(match, reference, new Map());
      for (const field of fields) {
        if (JSON.stringify(row[field] ?? null) !== JSON.stringify(hydrated[field] ?? null))
          hydrationDifferences[field] = (hydrationDifferences[field] ?? 0) + 1;
      }
    }
    failures += Object.values(hydrationDifferences).reduce((sum, count) => sum + count, 0);
    console.log(JSON.stringify({
      legacyRows: legacy.length, projectedRows: projected.rows.length,
      missingDueDates: legacy.filter(row => !row.dueDate).length,
      invalidDueDates: legacy.filter(row => row.dueDate && !parseWorkOrderDate(row.dueDate)).length,
      hydrationDifferences,
    }));
    if (process.argv.includes('--profile')) {
      const q = workOrderPageQuery.parse({ status: 'Overdue' });
      const query = sql`${projection} SELECT * FROM projection
        WHERE ${workOrderFilterPredicate(q)} ORDER BY ${workOrderOrdering(q)} LIMIT 10 OFFSET 0`;
      const report = await db.execute(sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${query}`);
      const plan = (report.rows[0]['QUERY PLAN'] as any)[0];
      const selected = await db.execute(query);
      const page = selected.rows.map(row => hydrateWorkOrderPageRow(row, reference, new Map()));
      const nodes: any[] = [];
      const visit = (node: any) => {
        if (node['Relation Name']) nodes.push({
          node: node['Node Type'], relation: node['Relation Name'],
          rows: node['Actual Rows'], loops: node['Actual Loops'],
        });
        for (const child of node.Plans ?? []) visit(child);
      };
      visit(plan.Plan);
      console.log(JSON.stringify({
        eligibleRows: legacy.length, selectedRows: selected.rows.length,
        hydratedRows: page.length, hydratedPageBytes: Buffer.byteLength(JSON.stringify(page)),
        plan: plan.Plan['Node Type'], planningMs: plan['Planning Time'],
        executionMs: plan['Execution Time'], nodes,
      }));
      return;
    }
    for (const tab of WORK_ORDER_TABS) {
      const differences: Record<string, number> = {};
      let tiedPositions = 0;
      for (const sortBy of [undefined, ...WORK_ORDER_SORT_FIELDS]) {
        for (const sortDir of ['asc', 'desc'] as const) {
          if (!sortBy && sortDir === 'desc') continue;
          const q = workOrderPageQuery.parse({ status: tab, sortBy, sortDir });
          const expected = filterAndSortWorkOrders(legacy, {
            activeTab: tab, sortField: sortBy, sortDir,
          });
          const actual = await db.execute(sql`${projection}
            SELECT wouuid FROM projection WHERE ${workOrderFilterPredicate(q)}
            ORDER BY ${workOrderOrdering(q)}`);
          const differing = expected.filter((row, i) => {
            const other = legacyById.get(actual.rows[i]?.wouuid as string);
            if (!other) return true;
            if (row.wouuid === other.wouuid) return false;
            const comparison = (sortBy ? compareWorkOrders(row, other, sortBy, sortDir, tab) : 0)
              || compareDefault(row, other);
            if (!comparison) tiedPositions++;
            return comparison !== 0;
          }).length
            + Math.abs(expected.length - actual.rows.length);
          if (differing) differences[`${sortBy ?? 'default'}:${sortDir}`] = differing;
          failures += differing;
        }
      }
      console.log(JSON.stringify({ tab, meaningfulOrderDifferences: differences, tiedPositions }));
    }
  });
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}
if (failures) {
  console.error(`Parity gate failed: ${failures} field/position differences. Live routes must not use this candidate.`);
  process.exitCode = 1;
} else {
  console.log('Read-only development-data hydration/membership/order parity passed.');
}
