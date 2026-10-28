/**
 * Isolated PostgreSQL integration checks. Only connection-local TEMP tables are
 * written. No completion, approval, RH update, stock, audit or sync mutations.
 * Run: node --import tsx tests/db/work-orders-pagination.test.ts
 */
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { initStorage, storage } from '../../server/storage';
import { getPool } from '../../server/db';
import { tenantStorage } from '../../server/utils/asyncLocalStorage';
import { listWorkOrders } from '../../server/modules/work-orders/services/workOrderService';
import { listJobs } from '../../server/modules/jobs/services/jobService';
import { workOrderPageQuery } from '../../shared/workOrdersPagination';
import { WORK_ORDER_TABS, filterAndSortWorkOrders, computeWorkOrderTabCounts } from '../../shared/utils/workOrderFilters';
import { parseWorkOrderDate } from '../../shared/workOrders/dateParse';
import { buildCompanyGraceConfig, computeWorkOrderStatus } from '../../shared/workOrders/status';
import { queryWorkOrderPage } from '../../server/modules/work-orders/repositories/workOrderPagingRepository';
import { workOrderProjection, workOrderSqlDate } from '../../server/modules/work-orders/repositories/workOrderPagingProjection';
import { resolveWorkOrderReadScope } from '../../server/modules/work-orders/repositories/workOrderPagingScope';
import { readWorkOrderQueue, readComponentJobsAvailability } from '../../server/modules/work-orders/services/workOrderPagingReadService';
import { createWorkOrderExport } from '../../server/modules/work-orders/services/workOrderPagingExportService';
import { buildComponentJobsWorkbook } from '../../client/src/pages/pms/componentJobsExport';

await initStorage();
const pool = await getPool();
const client = await pool.connect();
const db = drizzle(client);
let checks = 0;
const check = async (name: string, action: () => Promise<void>) => {
  await action(); checks++; console.log(`PASS ${name}`);
};
const ids = (rows: any[]) => rows.map(row => row.wouuid).sort();
const parse = (q: Record<string, unknown> = {}) => workOrderPageQuery.parse(q);
const scope = { vesselIds: ['fixture-A'] };
async function insert(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const columns = [...new Set(rows.flatMap(Object.keys))];
  const values = rows.flatMap(row => columns.map(key => row[key] ?? null));
  const tuples = rows.map((_, i) => `(${columns.map((__, j) => `$${i * columns.length + j + 1}`).join(',')})`);
  await client.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${tuples.join(',')}`, values);
}
try {
  for (const table of [
    'work_orders', 'jobs', 'components', 'vessels', 'pms_vessel_settings',
    'company_standard_grace_settings', 'planner_dates', 'adm_available_ranks',
    'master_user_vessels', 'job_component_links',
  ]) await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING IDENTITY)`);
  await insert('vessels', [
    { id: 'A', vuuid: 'fixture-A', name: 'Fixture A', code: 'A' },
    { id: 'B', vuuid: 'fixture-B', name: 'Fixture B', code: 'B' },
  ]);
  await insert('components', ['A', 'B'].map((vessel, i) => ({
    id: `c-${vessel}`, cuuid: `c-${vessel}`, vessel_id: `fixture-${vessel}`,
    component_code: '6.1', name: 'Fixture Component', data_scope: 'vessel', critical: true,
    current_cumulative_rh: String(100 + i * 1000), is_deleted: false,
  })));
  await insert('adm_available_ranks', [{ name: 'Chief Engineer', label: 'C/E', rank_id: 'R001', is_deleted: false, sort_order: 1 }]);
  await insert('pms_vessel_settings', [
    { vessel_id: 'fixture-A', updated_by: 'fixture', superintendent_lock_enabled: false, rh_grace_hours: 50 },
    { vessel_id: 'fixture-B', updated_by: 'fixture', superintendent_lock_enabled: true, rh_grace_hours: 50 },
  ]);
  await insert('master_user_vessels', [
    { user_uuid: 'fixture-user', vessel_id: 'fixture-A', is_active: true },
    { user_uuid: 'fixture-user', vessel_id: 'fixture-B', is_active: false },
  ]);
  await insert('jobs', Array.from({ length: 213 }, (_, i) => ({
    id: `j-${i}`, juuid: `j-${i}`, job_no: `JOB-${String(i).padStart(4, '0')}`, job_title: `Fixture Job ${i}`,
    vessel_id: 'fixture-A', component_id: 'c-A', component_code: '6.1', data_scope: 'vessel',
    maintenance_basis: i === 1 ? 'Running Hours' : 'Calendar', assigned_to: 'Chief Engineer',
    criticality: 'Yes', next_due_rh: '0', last_done_rh: '0', interval_running_hour: '100',
    rh_estimated_due_date: '01-Jan-2027', is_deleted: false,
  })));
  const day = (delta: number) => {
    const date = new Date(); date.setUTCDate(date.getUTCDate() + delta); return date.toISOString().slice(0, 10);
  };
  const records: Record<string, unknown>[] = [];
  const add = (count: number, extra: Record<string, unknown>) => {
    for (let i = 0; i < count; i++) {
      const id = `wo-${String(records.length).padStart(4, '0')}`;
      records.push({
        id, wouuid: id, work_order_no: id, template_code: 'JOB-0000', job_id: 'j-0',
        job_title: i === 0 ? 'Literal 100%_\\ pump' : `Fixture Job ${i}`,
        vessel_id: 'fixture-A', component: 'c-A', component_code: '6.1', data_scope: 'vessel',
        assigned_to: 'Unassigned', status: 'Active', maintenance_basis: 'Calendar',
        due_date: day(90), is_execution: false, work_order_type: 'Planned', is_deleted: false,
        submitted_date: i % 2 ? '02-Jan-2026' : '2026-01-03',
        approval_tier: i % 2 ? 'superintendent_locked' : 'standard',
        created_at: '2026-01-01T00:00:00Z', ...extra,
      });
    }
  };
  add(41, {});
  add(41, { due_date: day(1) });
  add(223, { due_date: '01-Jan-2000' });
  add(223, { status: 'Pending Approval', is_execution: true });
  add(41, { status: 'Completed', is_execution: true, date_completed: '02-Jan-2026' });
  add(41, { status: 'Postponed', postponement_reason: 'Spares' });
  add(41, { status: 'Draft', work_order_type: 'Unplanned' });
  add(1, { due_date: '', maintenance_basis: 'Running Hours', job_id: 'j-1', current_reading: '0', next_due_reading: '0', due_rh_snapshot: '0' });
  add(1, { due_date: '' });
  add(1, { status: '', is_execution: true, date_completed: '02-Jan-2026' });
  add(1, { vessel_id: 'fixture-B', due_date: day(90) });
  add(1, { is_deleted: true });
  add(1, { data_scope: 'fleet' });
  for (const due_date of ['2024-02-29', '25-Feb-2026', '28-Feb-2026', '03-Mar-2026', '31-Dec-2026'])
    add(1, { due_date, job_title: 'Lifecycle boundary fixture' });
  for (const next_due_reading of ['50', '100', '150', '200', '201'])
    add(1, { job_id: 'missing', maintenance_basis: 'Running Hours', next_due_reading, due_date: '', job_title: 'Lifecycle boundary fixture' });
  const mixedDates = ['', '1900-01-01', '2024-02-29', '01-Jan-2026', '31-Feb-2026', 'bad-date'];
  for (const submitted_date of mixedDates)
    add(1, { status: 'Pending Approval', is_execution: true, submitted_date, job_title: 'Mixed-date fixture' });
  for (const due_date of [
    '2026-09-30', '2026-09-30T13:59:59.999Z', '2026-09-30T14:00:00Z',
    '2026-10-01', '2026-10-01T13:59:59.999Z', '2026-10-01T14:00:00Z',
    '2025-12-31T14:00:00Z', '2026-01-01', '2026-01-01T07:59:59.999Z',
    '2026-01-01T08:00:00Z', '2026-12-31T14:00:00Z',
    '2026-03-07T08:00:00Z', '2026-03-08T08:00:00Z', '2026-03-09T07:00:00Z',
  ]) add(1, { due_date, status: 'Pending Approval', is_execution: true, work_order_type: 'Unplanned', job_title: 'Browser timezone fixture' });
  for (const next_due_reading of ['124', '125', '148', '149', '2260', '2284', '8860', '8884'])
    add(1, { due_date: '', job_id: 'timezone-missing', maintenance_basis: 'Running Hours', next_due_reading,
      status: 'Pending Approval', is_execution: true, work_order_type: 'Unplanned', job_title: 'Browser timezone fixture' });
  for (let offset = 0; offset < records.length; offset += 100) await insert('work_orders', records.slice(offset, offset + 100));
  await tenantStorage.run({ tuid: 'isolated-work-order-pagination', db, pool }, async () => {
    const baseline = await listWorkOrders('fixture-A');
    const counts = computeWorkOrderTabCounts(baseline);
    await check('browser/server timezone parity: single days, year/month/quarter, DST, RH, queues and filtered exports', async () => {
      const originalZone = process.env.TZ;
      try {
        for (const timeZone of ['Australia/Brisbane', 'Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Auckland']) {
          process.env.TZ = timeZone;
          const periods = [
            { mode: 'date-range', dateFrom: new Date(2026, 9, 1), dateTo: new Date(2026, 9, 1) },
            { mode: 'date-range', dateFrom: new Date(2026, 0, 1), dateTo: new Date(2026, 0, 1) },
            { mode: 'date-range', dateFrom: new Date(2026, 2, 7), dateTo: new Date(2026, 2, 9) },
            { mode: 'year-only', year: 2026 },
            { mode: 'year-quarter', year: 2026, quarter: 1 },
            { mode: 'year-quarter', year: 2026, quarter: 4 },
            { mode: 'year-months', year: 2026, months: [1, 10] },
            { mode: 'year-months', year: 2026, months: [2, 2] },
          ];
          for (const period of periods) {
            // Construct/compare exactly as the browser does, then restore UTC
            // before the database call. Request timeZone must be authoritative.
            process.env.TZ = timeZone;
            const encoded = JSON.stringify(period);
            const expected = filterAndSortWorkOrders(baseline, {
              activeTab: 'Unplanned', search: 'Browser timezone fixture', period: JSON.parse(encoded),
            });
            process.env.TZ = 'UTC';
            const q = parse({ vesselId: 'fixture-A', status: 'Unplanned', pageSize: 200,
              search: 'Browser timezone fixture', period: encoded, timeZone });
            const result = await queryWorkOrderPage(scope, q);
            assert.deepEqual(ids(result.items), ids(expected), `${timeZone}/${encoded}`);
            assert.equal(result.total, expected.length);
            const queue = await readWorkOrderQueue(scope, q);
            assert.deepEqual([...queue.ids].sort(), expected.map(row => row.id).sort());
            if (period === periods[0]) {
              const file = await createWorkOrderExport(scope, q, 'wo-excel', { vesselName: 'Fixture A', generatedAtLabel: 'Fixture', timeZone });
              try { assert.equal(file.rowCount, expected.length, `${timeZone} filtered export`); }
              finally { await rm(file.directory, { recursive: true, force: true }); }
            }
          }
        }
      } finally {
        if (originalZone === undefined) delete process.env.TZ; else process.env.TZ = originalZone;
      }
    });
    await check('fixed-clock calendar/leap/year/RH boundaries match the existing status helper', async () => {
      for (const graceMethod of ['FIXED_DAYS', 'MONTH_END', 'SPECIFIC_DATE_NEXT_MONTH']) {
        const company = { graceMethod, graceValue: 7, scope: 'ALL_WORK_ORDERS', fallbackGraceDays: 7 };
        for (const clock of ['2024-02-29', '2026-02-28', '2026-03-01', '2026-12-31']) {
          const reference = new Date(`${clock}T12:00:00Z`);
          const projection = workOrderProjection(scope, reference, company, 'fixture-A');
          const result = await db.execute(sql`${projection} SELECT * FROM projection WHERE job_title='Lifecycle boundary fixture'`);
          for (const row of result.rows as any[]) {
            const expected = computeWorkOrderStatus({
              dueDate: row.due_date, dueRH: row._due_rh, currentRH: row._current_rh,
              isExecution: row.is_execution, status: row.status, completionDateTime: row.date_completed,
              wasRejected: row.was_rejected ?? false, maintenanceBasis: row._basis,
              calendarLeadTimeDays: row._cal_lead, rhLeadTimeHours: row._rh_lead,
              vesselGraceSettings: { calendarGraceMode: 'COMPANY_STANDARD', calendarGraceDays: 7, rhGraceHours: 50 },
              companyGraceConfig: buildCompanyGraceConfig(company),
              referenceDate: reference,
            });
            assert.equal(row._computed, expected, `${clock}/${graceMethod}/${row.due_date}/${row.next_due_reading}`);
          }
        }
      }
    });
    await check('approved mixed-date submitted ordering is deterministic in both directions', async () => {
      for (const sortDir of ['asc', 'desc'] as const) {
        const result = await queryWorkOrderPage(scope, parse({
          vesselId: 'fixture-A', status: 'Pending Approval', search: 'Mixed-date fixture', sortBy: 'dueDate', sortDir,
        }));
        assert.deepEqual(result.items.map(row => row.submittedDate), sortDir === 'asc' ? mixedDates : [...mixedDates].reverse());
      }
    });
    await check('all seven tabs: complete totals, unfiltered badges, page bounds, no duplicate rows', async () => {
      for (const tab of WORK_ORDER_TABS) {
        const q = parse({ vesselId: 'fixture-A', status: tab, pageSize: '10' });
        const result = await queryWorkOrderPage(scope, q);
        const expected = filterAndSortWorkOrders(baseline, { activeTab: tab });
        assert.equal(result.total, expected.length, tab);
        assert.deepEqual(result.statusCounts, counts, tab);
        assert.equal(result.items.length, Math.min(10, expected.length));
        assert.equal(new Set(result.items.map(row => row.wouuid)).size, result.items.length);
      }
    });
    await check('page boundaries, final/empty pages, and stable repeated reads', async () => {
      const q = parse({ vesselId: 'fixture-A', status: 'Overdue', pageSize: '17' });
      const collected: any[] = [];
      const first = await queryWorkOrderPage(scope, q);
      for (let page = 1; page <= first.totalPages; page++)
        collected.push(...(await queryWorkOrderPage(scope, { ...q, page })).items);
      assert.deepEqual(ids(collected), ids(filterAndSortWorkOrders(baseline, { activeTab: 'Overdue' })));
      assert.equal(new Set(ids(collected)).size, collected.length);
      assert.deepEqual((await queryWorkOrderPage(scope, q)).items, first.items);
      assert.equal((await queryWorkOrderPage(scope, { ...q, page: 1000 })).items.length, 0);
    });
    await check('toolbar literal search, rank, criticality, postponement reason and all four periods', async () => {
      const filters = [
        { status: 'Overdue', search: '100%_\\' },
        { status: 'Overdue', rank: 'Chief Engineer', criticality: 'critical-component' },
        { status: 'Postponed', postponementReason: 'Spares' },
        ...[
          { mode: 'year-only', year: new Date().getFullYear() },
          { mode: 'year-quarter', year: new Date().getFullYear(), quarter: 4 },
          { mode: 'year-months', year: new Date().getFullYear(), months: [2, 2] },
          { mode: 'date-range', dateFrom: day(-1), dateTo: day(95) },
        ].map(period => ({ status: 'Planned', period: JSON.stringify(period) })),
      ];
      for (const filter of filters) {
        const q = parse({ vesselId: 'fixture-A', ...filter });
        const expected = filterAndSortWorkOrders(baseline, {
          activeTab: q.status, search: q.search, rank: q.rank,
          criticality: q.criticality, postponementReason: q.postponementReason, period: q.period,
        });
        const result = await queryWorkOrderPage(scope, q);
        assert.equal(result.total, expected.length, JSON.stringify(filter));
        assert.deepEqual(result.statusCounts, counts);
      }
    });
    await check('trusted assignments, Office fleet, Ship restriction and empty scopes', async () => {
      const office: any = { user: { userUuid: 'fixture-user' }, rbac: { role: 'Office', userType: 'Office', source: 'forwarded' } };
      assert.deepEqual(await resolveWorkOrderReadScope(office, parse({ scope: 'my', vesselIds: 'fixture-A,fixture-B' })), scope);
      assert.deepEqual(await resolveWorkOrderReadScope(office, parse()), { vesselIds: null });
      assert.deepEqual(await resolveWorkOrderReadScope({ ...office, user: { userUuid: 'unassigned' } }, parse({ scope: 'my' })), { vesselIds: [] });
      await assert.rejects(resolveWorkOrderReadScope({ ...office, rbac: { ...office.rbac, userType: 'Ship' } }, parse({ vesselId: 'fixture-B' })));
      const empty = await queryWorkOrderPage({ vesselIds: [] }, parse());
      assert.equal(empty.total, 0); assert.deepEqual(empty.items, []); assert.deepEqual(empty.rankOptions, []);
      assert.ok(Object.values(empty.statusCounts).every(count => count === 0));
      assert.equal((await readComponentJobsAvailability({ vesselIds: [] })).count, 0);
    });
    await check('off-page ordered queue is complete across the 200-record batch boundary', async () => {
      const q = parse({ vesselId: 'fixture-A', status: 'Pending Approval', sortBy: 'workOrderNo', sortDir: 'desc' });
      const queue = await readWorkOrderQueue(scope, q);
      const expected = filterAndSortWorkOrders(baseline, { activeTab: q.status, sortField: q.sortBy, sortDir: q.sortDir }).map(row => row.id);
      assert.ok(queue.ids.length > 200); assert.deepEqual(queue.ids, expected);
    });
    await check('mixed/invalid/empty SQL date parser matches the shared parser', async () => {
      for (const value of ['', 'bad-date', '31-Feb-2026', '2024-02-29', '29/02/2024', '01-Jan-2026', '1 January 2026', '2026-01-02T23:30:00-05:00']) {
        const result = await db.execute(sql`SELECT ${workOrderSqlDate(sql`${value}`)} AS parsed`);
        const expected = parseWorkOrderDate(value);
        assert.equal(result.rows[0].parsed ? new Date(result.rows[0].parsed as string).getTime() : null, expected?.getTime() ?? null, value);
      }
    });
    await check('Work Order XLSX remains complete, RH zero survives, and temporary output is removable', async () => {
      const file = await createWorkOrderExport(scope, parse({ vesselId: 'fixture-A', status: 'Due', search: 'not-found' }), 'wo-excel', { vesselName: 'Fixture A', generatedAtLabel: 'Fixture' });
      try {
        assert.equal(file.rowCount, baseline.length);
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(file.filePath);
        const sheet = workbook.getWorksheet('All Work Orders')!;
        assert.equal(sheet.rowCount, baseline.length + 1);
        assert.equal(sheet.getCell('A1').value, 'S.No');
        assert.ok(sheet.getRows(2, baseline.length)!.some(row => row.getCell(6).value === '0 RH'));
      } finally { await rm(file.directory, { recursive: true, force: true }); }
    });
    await check('PDF generation is server-side, complete-scope and produces a valid PDF', async () => {
      const file = await createWorkOrderExport(scope, parse({ vesselId: 'fixture-A', status: 'Postponed' }), 'wo-pdf', { vesselName: 'Fixture A', generatedAtLabel: 'Fixture' });
      try {
        assert.equal(file.rowCount, counts.Postponed);
        assert.equal((await readFile(file.filePath)).subarray(0, 5).toString(), '%PDF-');
      } finally { await rm(file.directory, { recursive: true, force: true }); }
    });
    await check('Component Jobs XLSX crosses the batch boundary with the original template and notices', async () => {
      const file = await createWorkOrderExport(scope, parse({ vesselId: 'fixture-A' }), 'component-jobs', { vesselName: 'Fixture A', generatedAtLabel: 'Fixture' });
      try {
        const jobs = await listJobs('fixture-A');
        const ranks = (await client.query('SELECT name,label,rank_id AS "rankId" FROM adm_available_ranks')).rows;
        const expected = buildComponentJobsWorkbook(jobs, await storage.getComponents('fixture-A'), await storage.getVessels(), ranks);
        assert.equal(file.rowCount, 213);
        assert.deepEqual(file.issues, expected.issues);
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(file.filePath);
        const sheet = workbook.getWorksheet('Vessel_Job')!;
        assert.equal(sheet.rowCount, 214); assert.equal(sheet.getCell('AB1').value, '_TEMPLATE_VERSION_2.0.0');
        for (let index = 1; index <= sheet.rowCount; index++) {
          // XLSX readers represent omitted empty-string cells as blanks.
          const cells = (source: ExcelJS.Worksheet) => Array.from({ length: 28 }, (_, column) =>
            source.getRow(index).getCell(column + 1).value ?? '');
          assert.deepEqual(cells(sheet), cells(expected.sheet), `row ${index}`);
          if (index > 1) assert.deepEqual(sheet.getRow(index).getCell(7).dataValidation, expected.sheet.getRow(index).getCell(7).dataValidation);
        }
        assert.ok(workbook.getWorksheet('Lists'));
      } finally { await rm(file.directory, { recursive: true, force: true }); }
    });
  });
} finally {
  for (const table of ['work_orders','jobs','components','vessels','pms_vessel_settings','company_standard_grace_settings','planner_dates','adm_available_ranks','master_user_vessels','job_component_links'])
    await client.query(`DROP TABLE IF EXISTS pg_temp.${table}`);
  client.release();
  await pool.end();
}
console.log(`Passed ${checks} isolated integration groups.`);
