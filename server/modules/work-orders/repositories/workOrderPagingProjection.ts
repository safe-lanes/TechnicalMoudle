import { sql, type SQL } from 'drizzle-orm';
import { WORK_ORDER_THRESHOLDS as T } from '@shared/workOrders/constants';
import { buildCompanyGraceConfig, type CompanyStandardGraceConfig } from '@shared/workOrders/status';
import { workOrderScopePredicate, type WorkOrderReadScope } from './workOrderPagingScope';

// All fragments in this module are application-authored expressions. Request
// values are only ever introduced through bound Drizzle parameters.
const raw = sql.raw;

/** Shared parser's supported mixed date formats, without throwing on bad rows.
 * Date-only values are UTC; datetime values retain their offset/precision.
 * Kept separate so differential fixtures can exercise this exact SQL expression.
 */
export function workOrderSqlDate(value: SQL): SQL {
  return sql`(SELECT CASE
    WHEN v ~ '^\\d{4}-\\d{1,2}-\\d{1,2}$' THEN
      CASE WHEN split_part(v,'-',1)::int BETWEEN 1900 AND 2200
        AND pg_input_is_valid(v, 'date') THEN v::date::timestamp AT TIME ZONE 'UTC' END
    WHEN v ~ '^\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}$' THEN
      CASE WHEN right(v,4)::int BETWEEN 1900 AND 2200
        AND pg_input_is_valid(regexp_replace(v,'^(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4})$','\\3-\\2-\\1'),'date')
        THEN regexp_replace(v,'^(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4})$','\\3-\\2-\\1')::date::timestamp AT TIME ZONE 'UTC' END
    WHEN v ~ '^\\d{1,2}[-/ ][A-Za-z]{3,9}[-/ ]\\d{4}$' THEN
      CASE WHEN right(v,4)::int BETWEEN 1900 AND 2200 AND pg_input_is_valid(v,'date')
        THEN v::date::timestamp AT TIME ZONE 'UTC' END
    WHEN v ~ '^\\d{4}-\\d{2}-\\d{2}[T ]' THEN
      CASE WHEN pg_input_is_valid(v,'timestamptz') THEN v::timestamptz END
    ELSE CASE WHEN pg_input_is_valid(v,'timestamptz') THEN v::timestamptz END
    END FROM (SELECT NULLIF(btrim(${value}), '') AS v) date_input)`;
}

export function workOrderSqlNumber(value: SQL): SQL {
  return sql`CASE WHEN ${value} IS NULL OR ${value}::text='' THEN NULL
    WHEN btrim(${value}::text)='' THEN 0::double precision
    WHEN pg_input_is_valid(${value}::text,'double precision') AND lower(${value}::text) NOT IN ('nan','+nan','-nan')
      THEN ${value}::double precision END`;
}

function applyGrace(method: string, days: number | null, due: SQL): SQL {
  if (method === 'MONTH_END')
    return sql`(date_trunc('month',${due}) + interval '1 month - 1 day')::date`;
  if (method === 'SPECIFIC_DATE_NEXT_MONTH')
    return sql`(date_trunc('month',${due}) + interval '1 month' + (${days || 5}::int - 1)*interval '1 day')::date`;
  return sql`(${due}::date + ${days || T.CALENDAR_GRACE_PERIOD_DAYS}::int)`;
}

function graceEnd(config: CompanyStandardGraceConfig): SQL {
  const due = raw('(_due_at AT TIME ZONE \'UTC\')');
  const primary = applyGrace(config.graceMethod, config.graceValue, due);
  if (config.scope === 'ALL_WORK_ORDERS') return primary;
  const fallback = config.fallbackMethod
    ? applyGrace(config.fallbackMethod, config.fallbackGraceDays, due)
    : sql`(${due}::date + ${config.fallbackGraceDays ?? T.CALENDAR_GRACE_PERIOD_DAYS}::int)`;
  return sql`CASE WHEN extract(day FROM date_trunc('month',${due}) + interval '1 month - 1 day')
    - extract(day FROM ${due}) <= 7 THEN ${primary} ELSE ${fallback} END`;
}

/** Narrow, nonmultiplying lookups; raw work_orders is scoped before hydration.
 * It deliberately reproduces the actual list inputs: Dual Frequency does not
 * acquire dueRH, and vesselCalendar/RhGraceConfig is NOT supplied by that list.
 */
export function workOrderProjection(
  scope: WorkOrderReadScope,
  reference: Date,
  companyRow: Parameters<typeof buildCompanyGraceConfig>[0],
  plannerVesselId: string | undefined,
): SQL {
  const company = buildCompanyGraceConfig(companyRow);
  const nowDay = reference.toISOString().slice(0, 10);
  const next = workOrderSqlNumber(raw('next_due_reading'));
  const lastDone = workOrderSqlNumber(raw('_j_last_done_rh'));
  const interval = workOrderSqlNumber(raw('_j_interval'));
  const woRH = sql`COALESCE(${next},CASE WHEN ${interval}>0 THEN ${lastDone}+${interval} END)`;
  const dueRH = sql`COALESCE(${workOrderSqlNumber(raw('_j_next_due_rh'))},
    CASE WHEN ${next} IS NOT NULL AND ${interval}>0 AND ${lastDone}+${interval}>${next}
      THEN ${lastDone}+${interval} ELSE ${woRH} END)`;
  const calStatus = sql`CASE WHEN _due_at IS NULL THEN 'Active'
    WHEN (_due_at AT TIME ZONE 'UTC')::date<${nowDay}::date
      THEN CASE WHEN ${nowDay}::date>_grace_end THEN 'Overdue' ELSE 'Due (Grace P)' END
    WHEN (_due_at AT TIME ZONE 'UTC')::date-${nowDay}::date<=_cal_lead THEN 'Due'
    ELSE 'Active' END`;
  return sql`WITH
    source AS (
      SELECT w.* FROM work_orders w
      WHERE w.data_scope='vessel' AND w.is_deleted IS DISTINCT FROM TRUE
        AND ${workOrderScopePredicate(scope)}
    ),
    linked AS (
      SELECT w.*,j.maintenance_basis AS _j_basis,j.assigned_to AS _j_assigned,
        j.criticality AS _j_criticality,j.next_due_rh AS _j_next_due_rh,
        j.last_done_rh AS _j_last_done_rh,j.interval_running_hour AS _j_interval,
        j.rh_estimated_due_date AS _expected,j.lead_time_value AS _lead_value,
        j.lead_time_unit AS _lead_unit,c.critical AS _component_critical,
        c.current_cumulative_rh AS _component_rh,c.cuuid AS _component_uuid,
        vs.superintendent_lock_enabled AS _lock,
        vs.calendar_grace_mode AS _grace_mode,vs.calendar_grace_days AS _grace_days,
        COALESCE(vs.rh_grace_hours,${T.RH_GRACE_PERIOD_HOURS}) AS _rh_grace,
        CASE WHEN j.job_priority='Critical' OR j.class_related='true'
          THEN COALESCE(vs.rh_lead_hours_critical,${T.RH_LEAD_TIME_HOURS_CRITICAL})
          ELSE COALESCE(vs.rh_lead_hours_non_critical,${T.RH_LEAD_TIME_HOURS_NON_CRITICAL}) END AS _rh_lead,
        COALESCE(CASE WHEN w.maintenance_basis IS DISTINCT FROM 'Running Hours'
          THEN CASE WHEN j.job_priority='Critical' OR j.class_related='true'
            THEN vs.calendar_lead_days_critical ELSE vs.calendar_lead_days_non_critical END END,
          ${T.CALENDAR_LEAD_TIME_DAYS}) AS _cal_lead,
        pd.planned_date AS _planned_date
      FROM source w
      LEFT JOIN LATERAL (
        SELECT j.* FROM jobs j
        WHERE j.vessel_id=w.vessel_id AND j.data_scope='vessel' AND j.is_deleted IS DISTINCT FROM TRUE
          AND (CASE WHEN NULLIF(w.job_id,'') IS NOT NULL THEN j.juuid=w.job_id
          ELSE j.job_no=w.template_code AND (
            (NULLIF(w.component_code,'') IS NOT NULL AND j.component_code=w.component_code)
            OR (NULLIF(w.component,'') IS NOT NULL AND j.component_id=w.component)
            OR (SELECT count(*) FROM jobs unique_j WHERE unique_j.vessel_id=w.vessel_id
              AND unique_j.job_no=w.template_code AND unique_j.data_scope='vessel'
              AND unique_j.is_deleted IS DISTINCT FROM TRUE)=1) END)
        ORDER BY CASE WHEN NULLIF(w.component_code,'') IS NOT NULL AND j.component_code=w.component_code THEN 0
          WHEN NULLIF(w.component,'') IS NOT NULL AND j.component_id=w.component THEN 1 ELSE 2 END,
          j.juuid
        LIMIT 1
      ) j ON TRUE
      LEFT JOIN LATERAL (
        SELECT c.* FROM components c WHERE c.vessel_id=w.vessel_id AND c.data_scope='vessel'
          AND c.is_deleted IS DISTINCT FROM TRUE
          AND CASE WHEN NULLIF(w.component_code,'') IS NOT NULL
            THEN c.component_code=w.component_code ELSE c.cuuid=w.component END
        ORDER BY c.cuuid LIMIT 1
      ) c ON TRUE
      LEFT JOIN pms_vessel_settings vs ON vs.vessel_id=w.vessel_id
      LEFT JOIN LATERAL (
        SELECT pd.planned_date FROM planner_dates pd WHERE pd.job_id=w.job_id AND pd.component_id=c.cuuid
          AND pd.vessel_id=${plannerVesselId ?? ''}
          AND NULLIF(pd.planned_date,'') IS NOT NULL
        ORDER BY pd.id DESC LIMIT 1
      ) pd ON TRUE
    ),
    parsed AS (
      SELECT linked.*,
        COALESCE(NULLIF(maintenance_basis,''),NULLIF(_j_basis,'')) AS _basis,
        CASE WHEN NULLIF(assigned_to,'') IS NOT NULL AND assigned_to<>'Unassigned'
          THEN assigned_to ELSE COALESCE(NULLIF(_j_assigned,''),'Unassigned') END AS _assigned,
        COALESCE(NULLIF(criticality,''),NULLIF(_j_criticality,'')) AS _criticality,
        ${workOrderSqlDate(raw('due_date'))} AS _due_at,
        ${workOrderSqlDate(raw('submitted_date'))} AS _submitted_at,
        ${workOrderSqlDate(raw('_expected'))} AS _expected_at,
        CASE WHEN COALESCE(NULLIF(maintenance_basis,''),NULLIF(_j_basis,''))='Running Hours' THEN ${dueRH} END AS _due_rh,
        CASE WHEN COALESCE(NULLIF(maintenance_basis,''),NULLIF(_j_basis,'')) IN ('Running Hours','Dual Frequency')
          THEN COALESCE(${workOrderSqlNumber(raw('_component_rh'))},${workOrderSqlNumber(raw('current_reading'))}) END AS _current_rh
      FROM linked
    ),
    grace AS (
      SELECT parsed.*, CASE WHEN _grace_mode='CUSTOM_DAYS'
        THEN (_due_at AT TIME ZONE 'UTC')::date + COALESCE(NULLIF(_grace_days,0),${T.CALENDAR_GRACE_PERIOD_DAYS})
        ELSE ${graceEnd(company)} END AS _grace_end
      FROM parsed
    ),
    lifecycle AS (
      SELECT grace.*, CASE
        WHEN lower(btrim(status)) IN ('completed','approved','closed','cancelled','canceled') THEN 'Completed'
        WHEN is_execution AND status='Pending Approval' THEN 'Pending Approval'
        WHEN is_execution AND status='Rejected' THEN 'Rejected'
        WHEN is_execution AND status IS DISTINCT FROM 'Reopened' AND was_rejected IS DISTINCT FROM TRUE
          THEN CASE WHEN NULLIF(date_completed,'') IS NOT NULL THEN 'Completed' ELSE 'Active' END
        WHEN status='Pending Approval' THEN 'Pending Approval'
        WHEN status='Pending Office Review' OR lower(btrim(status))='pending_office_review' THEN 'Pending Office Review'
        WHEN status IN ('Postponed','Awaiting Office Approval','Postponement Approved','Postponement Rejected','Rejected') THEN status
        WHEN status IS DISTINCT FROM 'Reopened' AND was_rejected IS DISTINCT FROM TRUE AND NULLIF(date_completed,'') IS NOT NULL THEN 'Completed'
        WHEN _basis='Running Hours' THEN CASE
          WHEN _due_rh IS NULL OR _current_rh IS NULL THEN 'Active'
          WHEN _due_rh-_current_rh < -_rh_grace THEN 'Overdue'
          WHEN _due_rh-_current_rh < 0 THEN 'Due (Grace P)'
          WHEN _due_rh-_current_rh <= _rh_lead THEN 'Due'
          ELSE 'Active' END
        ELSE ${calStatus} END AS _computed
      FROM grace
    ),
    projection AS (
      SELECT lifecycle.*,
        CASE WHEN work_order_type='Unplanned' THEN 'Unplanned'
          WHEN lower(btrim(status)) IN ('completed','approved','closed','cancelled','canceled') THEN 'Completed'
          ELSE COALESCE(NULLIF(_computed,''),NULLIF(status,''),'Active') END AS _effective,
        CASE WHEN lower(btrim(_basis))='running hours' THEN _expected
          WHEN lower(btrim(_basis))='dual frequency' THEN
            CASE WHEN NULLIF(due_date,'') IS NULL THEN _expected
              WHEN NULLIF(_expected,'') IS NULL THEN due_date
              WHEN _due_at IS NULL THEN _expected
              WHEN _expected_at IS NULL THEN due_date
              WHEN _expected_at<_due_at THEN _expected ELSE due_date END
          ELSE due_date END AS _display_due,
        CASE WHEN approval_tier='superintendent_locked' AND _lock IS DISTINCT FROM TRUE
          THEN 'superintendent_notification' ELSE approval_tier END AS _effective_tier
      FROM lifecycle
    )`;
}
