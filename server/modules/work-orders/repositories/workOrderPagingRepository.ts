import { sql, getTableColumns, eq, type SQL } from 'drizzle-orm';
import { admAvailableRanks, companyStandardGraceSettings, workOrders } from '@shared/schema';
import type { WorkOrderPageQuery, WorkOrderPage } from '@shared/workOrdersPagination';
import { WORK_ORDER_TABS } from '@shared/utils/workOrderFilters';
import { calculateMissedCycles, calculateMissedCyclesRH } from '@shared/dateUtils';
import { getWorkOrderListDueHour } from '../utils/workOrderPartADates';
import { getDb } from '../../../db';
import type { WorkOrderReadScope } from './workOrderPagingScope';
import { workOrderProjection, workOrderSqlDate, workOrderSqlNumber } from './workOrderPagingProjection';

const raw = sql.raw;
const and = (parts: SQL[]) => sql`(${sql.join(parts, sql` AND `)})`;
export function workOrderTabPredicate(tab: string): SQL {
  const executionAllowed = sql`(is_execution IS DISTINCT FROM TRUE OR status='Rejected')`;
  switch (tab) {
    case 'Planned': return sql`(is_execution IS DISTINCT FROM TRUE AND work_order_type IS DISTINCT FROM 'Unplanned' AND _effective='Active')`;
    case 'Due': return and([executionAllowed, sql`_effective IN ('Due','Due (Grace P)')`]);
    case 'Overdue': return and([executionAllowed, sql`_effective='Overdue'`]);
    case 'Completed': return sql`(work_order_type IS DISTINCT FROM 'Unplanned' AND _effective='Completed')`;
    case 'Postponed': return sql`(is_execution IS DISTINCT FROM TRUE AND _effective IN ('Postponed','Awaiting Office Approval','Postponement Approved'))`;
    case 'Unplanned': return sql`work_order_type='Unplanned'`;
    case 'Pending Approval': return sql`(CASE WHEN work_order_type='Unplanned' THEN
      CASE WHEN lower(btrim(status)) IN ('completed','approved','closed','cancelled','canceled') THEN 'Completed'
        ELSE status END ELSE _effective END IN ('Pending Approval','Pending Office Review'))`;
    default: throw new Error('Unsupported Work Order tab');
  }
}

function periodPredicate(period: NonNullable<WorkOrderPageQuery['period']>, timeZone: string): SQL {
  let days: SQL = sql`0`;
  let calendar: SQL = sql`TRUE`;
  const localDue = sql`(_due_at AT TIME ZONE ${timeZone})`;
  const elapsedDays = (start: SQL, end: SQL) =>
    sql`(floor(extract(epoch FROM (${end}-${start}))/86400 + 0.5)+1)`;
  if (period.mode === 'year-only') {
    const leap = period.year % 4 === 0 && (period.year % 100 !== 0 || period.year % 400 === 0);
    days = sql`${leap ? 366 : 365}`;
    calendar = sql`extract(year FROM ${localDue})=${period.year}`;
  } else if (period.mode === 'year-quarter') {
    // Construct the same local calendar dates as browser new Date(y,m,d),
    // including its historical year 1..99 remapping, without using server TZ.
    const year = period.year < 100 ? period.year + 1900 : period.year;
    const start = new Date(Date.UTC(year, (period.quarter - 1) * 3, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(year, period.quarter * 3, 0)).toISOString().slice(0, 10);
    days = elapsedDays(
      sql`(${start}::timestamp AT TIME ZONE ${timeZone})`,
      sql`(${end}::timestamp AT TIME ZONE ${timeZone})`,
    );
    calendar = sql`(extract(year FROM ${localDue})=${period.year}
      AND extract(month FROM ${localDue}) BETWEEN ${(period.quarter - 1) * 3 + 1} AND ${period.quarter * 3})`;
  } else if (period.mode === 'year-months') {
    const year = period.year < 100 ? period.year + 1900 : period.year;
    days = sql`${period.months.reduce((sum, month) => sum + new Date(Date.UTC(year, month, 0)).getUTCDate(), 0)}`;
    calendar = sql`(extract(year FROM ${localDue})=${period.year}
      AND extract(month FROM ${localDue}) IN (${sql.join(period.months.map(month => sql`${month}`), sql`,`)}))`;
  } else {
    const localMidnight = (value: string) =>
      sql`date_trunc('day',${new Date(value).toISOString()}::timestamptz AT TIME ZONE ${timeZone})`;
    const start = sql`(${localMidnight(period.dateFrom)} AT TIME ZONE ${timeZone})`;
    const end = sql`(${localMidnight(period.dateTo)} AT TIME ZONE ${timeZone})`;
    days = elapsedDays(start, end);
    const exclusiveEnd = sql`((${localMidnight(period.dateTo)} + interval '1 day') AT TIME ZONE ${timeZone})`;
    calendar = sql`(_due_at >= ${start} AND _due_at<${exclusiveEnd})`;
  }
  const due = sql`COALESCE(_due_rh,${workOrderSqlNumber(raw('next_due_reading'))})`;
  const current = sql`COALESCE(_current_rh,${workOrderSqlNumber(raw('current_reading'))})`;
  return sql`CASE WHEN _basis='Running Hours' THEN
    (${due} IS NOT NULL AND ${current} IS NOT NULL AND ${due}-${current}<=(${days})*24)
    ELSE (_due_at IS NOT NULL AND ${calendar}) END`;
}

export function workOrderFilterPredicate(q: WorkOrderPageQuery): SQL {
  const parts = [workOrderTabPredicate(q.status)];
  if (q.search) parts.push(sql`(strpos(lower(COALESCE(job_title,'')),lower(${q.search}))>0
    OR strpos(lower(COALESCE(work_order_no,'')),lower(${q.search}))>0
    OR strpos(lower(COALESCE(template_code,'')),lower(${q.search}))>0
    OR strpos(lower(COALESCE(execution_id,'')),lower(${q.search}))>0)`);
  if (q.rank && q.rank !== 'all') parts.push(sql`btrim(_assigned)=${q.rank}`);
  if (q.postponementReason && q.postponementReason !== 'all')
    parts.push(sql`postponement_reason=${q.postponementReason}`);
  if (q.criticality.length) {
    const options = q.criticality.map(criterion => criterion === 'critical'
      ? sql`lower(_criticality)='yes'`
      : criterion === 'non-critical' ? sql`lower(_criticality) IS DISTINCT FROM 'yes'`
      : sql`_component_critical IS TRUE`);
    parts.push(sql`(${sql.join(options, sql` OR `)})`);
  }
  if (q.period) parts.push(periodPredicate(q.period, q.timeZone));
  return and(parts);
}

const defaultPriority = raw(`CASE _computed WHEN 'Overdue' THEN 1 WHEN 'Due (Grace P)' THEN 2
  WHEN 'Due' THEN 3 WHEN 'Due Soon' THEN 4 WHEN 'Planned' THEN 5 WHEN 'Postponed' THEN 6
  WHEN 'Pending Approval' THEN 7 WHEN 'Active' THEN 8 WHEN 'Completed' THEN 9 WHEN 'Rejected' THEN 10 ELSE 99 END`);
const defaultOrder = sql`${defaultPriority},CASE WHEN COALESCE(due_date,'')='' THEN 0 ELSE 1 END,
  COALESCE(_due_at,'epoch'::timestamptz),created_at DESC,wouuid`;

/** Approved deterministic list and export ordering. Status priority is retained;
 * date ties are resolved by creation time and the stable Work Order identifier.
 */
export function workOrderOrdering(q: WorkOrderPageQuery): SQL {
  if (!q.sortBy) return defaultOrder;
  const dir = raw(q.sortDir);
  const text = (expr: SQL) => sql`(${expr}) COLLATE "en-x-icu" ${dir}`;
  let primary: SQL;
  switch (q.sortBy) {
    case 'component': primary = text(raw(`COALESCE(component,'')`)); break;
    case 'jobTitle': primary = text(raw(`COALESCE(job_title,'')`)); break;
    case 'assignedTo': primary = text(raw(`COALESCE(_assigned,'')`)); break;
    case 'workOrderNo':
      primary = text(['Pending Approval', 'Completed'].includes(q.status)
        ? raw(`COALESCE(NULLIF(execution_id,''),NULLIF(work_order_no,''),template_code,'')`)
        : raw(`COALESCE(NULLIF(work_order_no,''),template_code,'')`));
      break;
    case 'dueDate': {
      const value = ['Pending Approval', 'Completed'].includes(q.status)
        ? raw(`COALESCE(submitted_date,'')`) : raw(`COALESCE(_display_due,'')`);
      const date = workOrderSqlDate(value);
      primary = sql`CASE WHEN ${value}='' THEN 0 WHEN ${date} IS NOT NULL THEN 1 ELSE 2 END ${dir},
        ${date} ${dir},${text(sql`CASE WHEN ${date} IS NULL THEN ${value} ELSE '' END`)}`;
      break;
    }
    case 'status': primary = sql`CASE COALESCE(NULLIF(_computed,''),status,'')
      WHEN 'Overdue' THEN 0 WHEN 'Due' THEN 1 WHEN 'Due (Grace P)' THEN 2 WHEN 'Active' THEN 3
      WHEN 'Pending Approval' THEN 4 WHEN 'Postponed' THEN 5 WHEN 'Draft' THEN 6 WHEN 'Completed' THEN 7 ELSE 99 END ${dir}`; break;
    case 'dateCompleted': primary = text(raw(`COALESCE(NULLIF(date_completed,''),'9999')`)); break;
    case 'plannedDate': primary = text(raw(`COALESCE(NULLIF(_planned_date,''),'9999')`)); break;
    case 'postponeUntil': primary = text(raw(`COALESCE(NULLIF(postponement_end_date,''),'9999')`)); break;
    case 'postponementReason': primary = text(raw(`COALESCE(postponement_reason,'')`)); break;
    case 'daysLate': primary = sql`COALESCE(days_late,0) ${dir}`; break;
    case 'approvalTier': primary = text(raw(`COALESCE(approval_tier,'')`)); break;
  }
  return sql`${primary},${defaultOrder}`;
}

export function hydrateWorkOrderPageRow(row: Record<string, any>, reference: Date, ranks: Map<string, string>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, column] of Object.entries(getTableColumns(workOrders)))
    result[key] = row[column.name];
  const assigned = row._assigned;
  let missed = result.missedCycles || 0;
  if (missed === 0 && ['Overdue', 'Due', 'Due (Grace P)'].includes(row._computed)) {
    if (result.maintenanceBasis === 'Running Hours' && row._due_rh != null && row._current_rh != null) {
      const interval = Number(row._j_interval);
      if (interval > 0) missed = calculateMissedCyclesRH(row._due_rh, row._current_rh, interval);
    } else if (result.maintenanceBasis !== 'Running Hours' && result.dueDate && result.frequencyValue && result.frequencyUnit) {
      missed = calculateMissedCycles(result.dueDate, reference.toISOString(), result.frequencyValue, result.frequencyUnit);
    }
  }
  const basis = row._basis;
  return {
    ...result, maintenanceBasis: basis,
    assignedTo: assigned,
    assignedToRankId: (assigned !== 'Unassigned' ? ranks.get(String(assigned).toLowerCase().trim()) : null) ?? result.assignedToRankId ?? null,
    criticality: row._criticality, computedStatus: row._computed, missedCycles: missed,
    leadTimeValue: row._lead_value ?? null, leadTimeUnit: row._lead_unit ?? null,
    componentCritical: row._component_critical === true,
    dueRH: row._due_rh ?? null, currentRH: row._current_rh ?? null,
    nextDueHour: getWorkOrderListDueHour({ ...result, maintenanceBasis: basis }),
    rhEstimatedDueDate: ['Running Hours', 'Dual Frequency'].includes(basis) ? row._expected ?? null : null,
    rhLeadTimeHours: result.maintenanceBasis === 'Running Hours' ? row._rh_lead : null,
    plannedDate: row._planned_date || null,
  };
}

/** A single consistent read context for pages and subsequent complete-scope
 * operations. No full Jobs/Components/Work Orders reads occur here.
 */
export async function withWorkOrderReadSnapshot<T>(
  scope: WorkOrderReadScope,
  q: WorkOrderPageQuery,
  action: (context: {
    tx: Awaited<ReturnType<typeof getDb>>;
    projection: SQL; where: SQL; order: SQL; reference: Date; ranks: Map<string, string>;
  }) => Promise<T>,
  reference = new Date(),
): Promise<T> {
  const db = await getDb();
  return db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const company = await tx.select().from(companyStandardGraceSettings).limit(1);
    const rankRows = await tx.select().from(admAvailableRanks)
      .where(eq(admAvailableRanks.isDeleted, false)).orderBy(admAvailableRanks.sortOrder);
    const ranks = new Map<string, string>();
    for (const rank of rankRows) {
      for (const label of [rank.name, rank.label]) {
        const key = label?.toLowerCase().trim();
        if (key && rank.rankId && !ranks.has(key)) ranks.set(key, rank.rankId);
      }
    }
    return action({
      tx: tx as unknown as Awaited<ReturnType<typeof getDb>>,
      projection: workOrderProjection(scope, reference, company[0], q.vesselId),
      where: workOrderFilterPredicate(q), order: workOrderOrdering(q), reference, ranks,
    });
  });
}

export async function queryWorkOrderPage(scope: WorkOrderReadScope, q: WorkOrderPageQuery): Promise<WorkOrderPage<any>> {
  return withWorkOrderReadSnapshot(scope, q, async ({ tx, projection, where, order, reference, ranks }) => {
    const summary = await tx.execute(sql`${projection}
      SELECT count(*) FILTER (WHERE ${where})::int AS total,
        jsonb_build_object(${sql.join(WORK_ORDER_TABS.flatMap(tab => [
          sql`${tab}::text`, sql`count(*) FILTER (WHERE ${workOrderTabPredicate(tab)})::int`,
        ]), sql`,`)}) AS statuses,
        COALESCE(jsonb_agg(DISTINCT btrim(_assigned)) FILTER (WHERE btrim(_assigned)<>''),'[]'::jsonb) AS ranks,
        jsonb_build_object(
          'superintendent_locked',count(*) FILTER (WHERE ${where} AND _effective_tier='superintendent_locked'),
          'superintendent_notification',count(*) FILTER (WHERE ${where} AND _effective_tier='superintendent_notification'),
          'ce_with_justification',count(*) FILTER (WHERE ${where} AND _effective_tier='ce_with_justification'),
          'standard',count(*) FILTER (WHERE ${where} AND COALESCE(NULLIF(_effective_tier,''),'standard')='standard')
        ) AS tiers
      FROM projection`);
    const meta = summary.rows[0] as any;
    const page = await tx.execute(sql`${projection}
      SELECT * FROM projection WHERE ${where} ORDER BY ${order}
      LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`);
    return {
      items: page.rows.map(row => hydrateWorkOrderPageRow(row, reference, ranks)),
      total: meta.total, page: q.page, pageSize: q.pageSize,
      totalPages: Math.ceil(meta.total / q.pageSize),
      statusCounts: meta.statuses, approvalTierCounts: meta.tiers,
      rankOptions: (meta.ranks as string[]).sort((a, b) => a.localeCompare(b)),
    };
  });
}
