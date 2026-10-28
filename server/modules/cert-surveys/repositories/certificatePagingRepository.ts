import { sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface CertificatePagingFilters {
  vesselId?: string;
  vesselIds?: string[];
  vesselName?: string;
  vesselNames?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

// Values come only from this whitelist; request text is never a SQL identifier.
const textSorts: Record<string, SQL> = {
  id: sql`coalesce(nullif(p.company_id, ''), p.master_id)`,
  companyId: sql`coalesce(nullif(p.company_id, ''), p.master_id)`,
  certificateName: sql`coalesce(nullif(p.certificate_label, ''), p.certificate_name)`,
  name: sql`coalesce(nullif(p.certificate_label, ''), p.certificate_name)`,
  vessel: sql`p.vessel_name`,
  certificateNumber: sql`coalesce(p.certificate_number, '')`,
  type: sql`coalesce(p.company_group, '')`,
  companyGroup: sql`coalesce(p.company_group, '')`,
  issueDate: sql`coalesce(p.issue_date, '')`,
  expiryDate: sql`coalesce(p.expiry_date, '')`,
  lastAnnual: sql`coalesce(p.last_annual, '')`,
  nextAnnual: sql`coalesce(p.next_annual, '')`,
  lastInterm: sql`coalesce(p.last_interm, '')`,
  nextInterm: sql`coalesce(p.next_interm, '')`,
  endorsementDate: sql`coalesce(p.endorsement_date, '')`,
};
const naturalLocale = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  .resolvedOptions().locale;

// ECMAScript trim whitespace, not PostgreSQL btrim's space-only default.
const trimCharacters = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680'
  + '\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a'
  + '\u2028\u2029\u202f\u205f\u3000\ufeff';

function scope(filters: CertificatePagingFilters) {
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

function eligibility(filters: CertificatePagingFilters) {
  return sql`
    applicability_source AS MATERIALIZED (
      SELECT a.*, row_number() OVER () AS source_order
      FROM vessel_certificate_applicability a
      WHERE a.is_applicable = true AND (a.is_deleted = false OR a.is_deleted IS NULL)
    ),
    scoped AS MATERIALIZED (
      SELECT a.*, min(a.source_order) OVER (PARTITION BY a.vessel_id) AS vessel_order
      FROM applicability_source a WHERE ${scope(filters)}
    ),
    eligible AS MATERIALIZED (
      SELECT a.vessel_id, a.vessel_name, a.master_id, a.source_order, a.vessel_order,
        m.company_id, m.certificate_label, m.certificate_name, m.company_group,
        coalesce(m.company_sequence, m.sequence, 9999) AS effective_sequence
      FROM scoped a
      JOIN ship_certificates_master m ON m.master_id = a.master_id
      WHERE m.is_active = true AND (m.is_deleted = false OR m.is_deleted IS NULL)
    )
  `;
}

/** Scope, count, every sort and page selection stay in PostgreSQL. */
export async function queryCertificatePage(
  db: Pick<NodePgDatabase, 'execute'>, filters: CertificatePagingFilters,
) {
  const textSort = filters.sortBy && Object.hasOwn(textSorts, filters.sortBy)
    ? textSorts[filters.sortBy] : undefined;
  if (textSort && naturalLocale !== 'en-US') {
    throw new Error(`Certificate natural sort requires en-US runtime locale; found ${naturalLocale}`);
  }
  const page = filters.page || 1;
  const limit = filters.limit || 100;
  const sortOrder = filters.sortOrder?.toLowerCase() === 'desc' ? 'desc' : 'asc';
  const common = eligibility(filters);
  const counts = await db.execute(sql`
    WITH ${common}
    SELECT count(*)::int AS total,
      (SELECT count(*)::int FROM scoped) AS scoped_total FROM eligible
  `);
  const total = Number(counts.rows[0].total);
  if (Number(counts.rows[0].scoped_total) === 0) {
    return { certificates: [], total: 0, page, limit };
  }
  // Match the old slice window, including negative legacy inputs.
  const offset = (page - 1) * limit;
  const index = (value: number) => value < 0
    ? Math.max(total + value, 0) : Math.min(value, total);
  const start = index(offset);
  const length = Math.max(index(offset + limit) - start, 0);
  const direction = sql.raw(sortOrder === 'desc' ? 'DESC' : 'ASC');
  const baseOrder = sql`p.vessel_order ASC, p.effective_sequence ASC, p.source_order ASC`;
  const order = textSort
    ? sql`(${textSort}) COLLATE public.certificates_natural_en_us ${direction}, ${baseOrder}`
    : filters.sortBy
      ? sql`p.effective_sequence ${direction}, ${baseOrder}` : baseOrder;
  const rows = await db.execute(sql`
    WITH ${common},
    data_source AS MATERIALIZED (
      SELECT d.id, d.vessel_id || '-' || d.master_id AS data_key,
        d.certificate_number, d.issue_date, d.expiry_date, d.last_annual, d.next_annual,
        d.last_interm, d.next_interm, d.endorsement_date, d.last_edit_upload,
        row_number() OVER () AS source_order
      FROM vessel_certificate_data d
      WHERE d.is_deleted = false OR d.is_deleted IS NULL
    ),
    data_map AS MATERIALIZED (
      SELECT DISTINCT ON (data_key) * FROM data_source ORDER BY data_key, source_order DESC
    ),
    candidates AS (
      SELECT e.*, d.id AS data_id, d.certificate_number, d.issue_date, d.expiry_date,
        d.last_annual, d.next_annual, d.last_interm, d.next_interm,
        d.endorsement_date, d.last_edit_upload
      FROM eligible e
      LEFT JOIN data_map d ON d.data_key = e.vessel_id || '-' || e.master_id
    ),
    page AS MATERIALIZED (
      SELECT p.* FROM candidates p ORDER BY ${order} LIMIT ${length} OFFSET ${start}
    )
    SELECT
      coalesce(nullif(p.company_id, ''), p.master_id) AS id,
      coalesce(nullif(p.certificate_label, ''), p.certificate_name) AS "certificateName",
      coalesce(p.company_group, '') AS type,
      p.vessel_name AS vessel, p.vessel_id AS "vesselId", p.master_id AS "masterId",
      p.effective_sequence AS "companySequence",
      coalesce(p.certificate_number, '') AS "certificateNumber",
      coalesce(p.issue_date, '') AS "issueDate", coalesce(p.expiry_date, '') AS "expiryDate",
      coalesce(p.last_annual, '') AS "lastAnnual", coalesce(p.next_annual, '') AS "nextAnnual",
      coalesce(p.last_interm, '') AS "lastInterm", coalesce(p.next_interm, '') AS "nextInterm",
      coalesce(p.endorsement_date, '') AS "endorsementDate",
      coalesce(p.last_edit_upload, '') AS "lastEditUpload", d.attachments
    FROM page p
    LEFT JOIN vessel_certificate_data d ON d.id = p.data_id
    ORDER BY ${order}
  `);
  return {
    certificates: rows.rows.map(row => ({ ...row, attachments: row.attachments || [] })),
    total, page, limit, totalPages: Math.ceil(total / limit),
    sortBy: filters.sortBy || 'companySequence', sortOrder,
  };
}
