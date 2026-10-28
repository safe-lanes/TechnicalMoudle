import { sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface SurveyPagingFilters {
  vesselId?: string;
  vesselIds?: string[];
  vesselName?: string;
  vesselNames?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

// Preserve Survey aliases, including companyId sorting by compound response ID.
// Request strings are never used as SQL identifiers or raw SQL.
const textSorts: Record<string, SQL> = {
  id: sql`p.vessel_id || '::' || p.master_id`,
  companyId: sql`p.vessel_id || '::' || p.master_id`,
  surveyName: sql`coalesce(nullif(p.survey_label, ''), p.survey_name)`,
  name: sql`coalesce(nullif(p.survey_label, ''), p.survey_name)`,
  vessel: sql`p.vessel_name`,
  type: sql`coalesce(p.company_group, '')`,
  companyGroup: sql`coalesce(p.company_group, '')`,
  surveyDate: sql`coalesce(p.survey_date, '')`,
  dueDate: sql`coalesce(p.due_date, '')`,
};
const defaultLocale = new Intl.Collator().resolvedOptions().locale;

// JavaScript trim includes Unicode whitespace that PostgreSQL btrim omits.
const trimCharacters = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680'
  + '\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a'
  + '\u2028\u2029\u202f\u205f\u3000\ufeff';

function scope(filters: SurveyPagingFilters): SQL {
  if (filters.vesselId && filters.vesselId !== 'all') {
    return sql`a.vessel_id = ${filters.vesselId}`;
  }
  if (filters.vesselId === 'all' && filters.vesselIds?.length) {
    return sql`a.vessel_id = ANY(${sql.param(filters.vesselIds)}::text[])`;
  }
  const name = sql`lower(btrim(a.vessel_name, ${trimCharacters}) COLLATE "unicode")`;
  if (filters.vesselName) {
    return sql`${name} = ${filters.vesselName.toLowerCase().trim()}`;
  }
  if (filters.vesselNames) {
    return sql`${name} = ANY(${sql.param(filters.vesselNames.split(',')
      .map(value => value.toLowerCase().trim()))}::text[])`;
  }
  return sql`true`;
}

function eligibility(filters: SurveyPagingFilters): SQL {
  return sql`
    applicability_source AS MATERIALIZED (
      SELECT a.*, row_number() OVER () AS source_order
      FROM vessel_survey_applicability a
      WHERE a.is_applicable = true AND (a.is_deleted = false OR a.is_deleted IS NULL)
    ),
    scoped AS MATERIALIZED (
      SELECT a.*, min(a.source_order) OVER (PARTITION BY a.vessel_id) AS vessel_order
      FROM applicability_source a WHERE ${scope(filters)}
    ),
    eligible AS MATERIALIZED (
      SELECT a.vessel_id, a.vessel_name, a.master_id, a.source_order, a.vessel_order,
        m.company_id, m.survey_label, m.survey_name, m.company_group,
        coalesce(m.company_sequence, m.sequence, 9999) AS effective_sequence
      FROM scoped a
      JOIN ship_surveys_master m ON m.master_id = a.master_id
      WHERE m.is_active = true AND m.is_deleted = false
    )
  `;
}

/** SQL scope/count/all supported sorts/page, followed by page-only attachments. */
export async function querySurveyPage(
  db: Pick<NodePgDatabase, 'execute'>, filters: SurveyPagingFilters,
) {
  const textSort = filters.sortBy && Object.hasOwn(textSorts, filters.sortBy)
    ? textSorts[filters.sortBy] : undefined;
  if (textSort && defaultLocale !== 'en-US') {
    throw new Error(`Survey default sort requires en-US runtime locale; found ${defaultLocale}`);
  }
  const page = filters.page || 1;
  const limit = filters.limit || 100;
  const common = eligibility(filters);
  const counts = await db.execute(sql`
    WITH ${common}
    SELECT count(*)::int AS total,
      (SELECT count(*)::int FROM scoped) AS scoped_total FROM eligible
  `);
  const total = Number(counts.rows[0].total);
  if (Number(counts.rows[0].scoped_total) === 0) {
    return { surveys: [], total: 0, page, limit, totalPages: 0 };
  }

  // Retain legacy slice windows rather than introducing new input restrictions.
  const offset = (page - 1) * limit;
  const index = (value: number) => value < 0
    ? Math.max(total + value, 0) : Math.min(value, total);
  const start = index(offset);
  const length = Math.max(index(offset + limit) - start, 0);
  const direction = sql.raw(filters.sortOrder?.toLowerCase() === 'desc' ? 'DESC' : 'ASC');
  const baseOrder = sql`p.vessel_order ASC, p.effective_sequence ASC, p.source_order ASC`;
  const order = textSort
    ? sql`(${textSort}) COLLATE public.surveys_default_en_us ${direction}, ${baseOrder}`
    : filters.sortBy ? sql`p.effective_sequence ${direction}, ${baseOrder}` : baseOrder;
  const rows = await db.execute(sql`
    WITH ${common},
    data_source AS MATERIALIZED (
      SELECT d.id, d.vessel_id || '-' || d.master_id AS data_key,
        d.survey_date, d.due_date, d.first_range_date, d.second_range_date,
        d.postponed, d.last_edit_upload, row_number() OVER () AS source_order
      FROM vessel_survey_data d
    ),
    data_map AS MATERIALIZED (
      SELECT DISTINCT ON (data_key) * FROM data_source ORDER BY data_key, source_order DESC
    ),
    candidates AS (
      SELECT e.*, d.id AS data_id, d.survey_date, d.due_date, d.first_range_date,
        d.second_range_date, d.postponed, d.last_edit_upload
      FROM eligible e
      LEFT JOIN data_map d ON d.data_key = e.vessel_id || '-' || e.master_id
    ),
    page AS MATERIALIZED (
      SELECT p.* FROM candidates p ORDER BY ${order} LIMIT ${length} OFFSET ${start}
    )
    SELECT
      p.vessel_id || '::' || p.master_id AS id,
      coalesce(nullif(p.company_id, ''), p.master_id) AS "companyId",
      coalesce(nullif(p.survey_label, ''), p.survey_name) AS "surveyName",
      coalesce(p.company_group, '') AS type,
      p.vessel_name AS vessel, p.vessel_id AS "vesselId", p.master_id AS "masterId",
      p.effective_sequence AS "companySequence",
      coalesce(p.survey_date, '') AS "surveyDate", coalesce(p.due_date, '') AS "dueDate",
      coalesce(p.first_range_date, '') AS "firstRangeDate",
      coalesce(p.second_range_date, '') AS "secondRangeDate",
      coalesce(p.postponed, '') AS postponed, coalesce(p.last_edit_upload, '') AS "lastEdit",
      d.attachments
    FROM page p
    LEFT JOIN vessel_survey_data d ON d.id = p.data_id
    ORDER BY ${order}
  `);
  return {
    surveys: rows.rows.map(row => ({ ...row, attachments: row.attachments || [] })),
    total, page, limit, totalPages: Math.ceil(total / limit),
  };
}
